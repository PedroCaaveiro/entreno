// Pruebas básicas: npm install jsdom && APP=index.html node test.js
const fs = require("fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(process.env.APP || "index.html", "utf8");
let fails = 0;
const ok = (c, m) => { if (c) console.log("ok  - " + m); else { fails++; console.log("MAL - " + m); } };

function boot(stored, date) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously", url: "https://x.github.io/entreno/",
    beforeParse(w) {
      if (stored) w.localStorage.setItem("entreno.v1", JSON.stringify(stored));
      if (date) { const D = w.Date; w.Date = class extends D { constructor(...a) { super(...(a.length ? a : [date])); } }; }
      w.confirm = () => true;
    }
  });
  return dom.window;
}

// 1. plan nuevo
let w = boot(null, "2026-09-21T10:00:00");            // lunes
let A = w.APP;
ok(A.state.v === 2, "plan v2 por defecto");
ok(A.state.days.map(d => d.wd.join()).join("|") === "1|2|3|5,6", "días: lun, mar, mié, vie+sáb");
ok(!A.dayForDate(new w.Date("2026-09-24T10:00:00")), "jueves sin sesión");
ok(!A.dayForDate(new w.Date("2026-09-27T10:00:00")), "domingo sin sesión");
let hoy = w.document.getElementById("v-hoy").textContent;
ok(hoy.includes("Antes: activación") && !hoy.includes("estiramientos"), "lunes muestra activación y no estiramientos");
ok(w.document.getElementById("hdrDay").textContent === "Fuerza A", "lunes = Fuerza A");
let missing = [];
A.state.days.forEach(d => d.ex.forEach(e => { if (e.ref && !A.REF[e.ref]) missing.push(e.ref); }));
A.MOV.act.concat(A.MOV.est).forEach(m => { if (!A.REF[m.ref]) missing.push(m.ref); });
ok(!missing.length, "todas las imágenes existen " + missing.join(","));

// 2. registro de remo
let r = A.logSession("e16", { cardio: { min: "12", m: "2400", spm: "26", ppm: "" } }, "2026-09-22");
ok(r && r.cardio.m === 2400 && r.cardio.ppm === "", "registro de remo guarda metros");
ok(A.setsText(r) === "12 min · 2400 m · 26 p/min", "texto de remo: " + A.setsText(r));
ok(A.logSession("e16", { cardio: {} }) === null, "registro vacío no se guarda");
let c = A.logSession("e7", { cardio: { min: "30", inc: "7", kmh: "5", ppm: "118" } }, "2026-09-22");
ok(A.setsText(c) === "30 min · 7% · 5 km/h · 118 ppm", "texto de cinta: " + A.setsText(c));

// 3. hoja de ejercicio y de movilidad
w.document.querySelector('[data-ex="e1"]').click();
ok(w.document.querySelectorAll("#sheetBox input[data-k=kg]").length === 4, "prensa abre con 4 series");
w.document.querySelector('[data-act="close"]').click();
w.document.querySelector('[data-mov="m1"]').click();
ok(w.document.getElementById("sheetBox").textContent.includes("talones"), "hoja de puente de glúteo");

// 4. editor: crear cardio de remo
let e = A.addExercise("d4", { name: "Remo extra", t: "c:remo", sets: 1, reps: "10 min" });
ok(e.t === "c" && e.cm === "remo", "nuevo ejercicio de remo");

// 4b. alimentación
A.FOOD_WEEK.forEach((d, i) => {
  const miss = d.m.filter(id => !A.MEALS[id]);
  ok(!miss.length, "día " + i + " con comidas válidas " + miss.join(","));
  const tt = A.foodTotals(d.m);
  ok(tt.p >= 150 && tt.k >= 1900 && tt.k <= 2350, "día " + i + ": " + tt.k + " kcal, " + tt.p + " g");
});
A.setView("food");
ok(w.document.getElementById("hdrDay").textContent === "Lunes", "comida abre en el día de hoy");
w.document.querySelector('[data-meal="com_pasta"]').click();
ok(w.document.getElementById("v-food").textContent.includes("Hoy llevas 680 kcal y 52 g"), "marcar comida suma");
ok(JSON.parse(w.localStorage.getItem("entreno.v1")).eaten["2026-09-21"].includes("com_pasta"), "comida marcada guardada");
w.document.querySelector('[data-meal="com_pasta"]').click();
ok(w.document.getElementById("v-food").textContent.includes("Hoy llevas 0 kcal"), "desmarcar resta");
w.document.querySelector('[data-fday="0"]').click();
ok(w.document.getElementById("hdrDay").textContent === "Domingo" && !w.document.querySelector("[data-meal]"), "otro día: solo consulta");
A.setView("hoy");

// 5. migración desde el plan viejo
const viejo = { v: 1, days: [
  { id: "d1", name: "Fuerza A", wd: [1], ex: [{ id: "e1", t: "f", name: "Prensa", sets: 3, reps: "12" },
    { id: "ek3x9z1ab", t: "f", name: "Mi ejercicio", sets: 3, reps: "10" }] },
  { id: "d2", name: "Intervalos", wd: [3], ex: [{ id: "e7", t: "c", name: "Cinta", sets: 1, reps: "35" }] } ],
  logs: [{ id: "l1", exId: "e1", date: "2026-09-01", sets: [{ kg: 80, reps: 12 }] },
         { id: "l2", exId: "e7", date: "2026-09-03", cardio: { min: 35, inc: 12, kmh: 5.5 } }] };
w = boot(viejo, "2026-09-24T10:00:00");               // jueves
A = w.APP;
ok(A.state.v === 2 && A.state.days.length === 4, "plan viejo actualizado");
ok(A.state.logs.length === 2, "registros conservados");
ok(A.state.eaten && typeof A.state.eaten === "object", "estado viejo recibe registro de comidas");
ok(A.logsOf("e1")[0].sets[0].kg === 80, "historial de prensa intacto");
ok(A.setsText(A.state.logs[1]) === "35 min · 12% · 5.5 km/h", "cardio antiguo se lee: " + A.setsText(A.state.logs[1]));
ok(A.findEx("ek3x9z1ab") && A.findEx("ek3x9z1ab").day.id === "d1", "ejercicio propio conservado");
ok(w.localStorage.getItem("entreno.v1.copia-v1") !== null, "copia del plan viejo guardada");
ok(w.document.getElementById("hdrDay").textContent === "Descanso", "jueves = descanso");
ok(!w.document.getElementById("v-hoy").textContent.includes("Figura 4"), "descanso sin estiramientos");
A.setView("plan"); ok(!w.document.getElementById("v-plan").textContent.includes("Estiramientos"), "plan sin estiramientos");
["plan", "food", "hist", "set"].forEach(v => { A.setView(v); ok(w.document.getElementById("v-" + v).innerHTML.length > 50, "vista " + v); });

// 6. importar copia vieja
ok(A.importJSON(JSON.stringify(viejo)) && A.state.v === 2, "importar copia vieja la actualiza");

console.log(fails ? fails + " fallos" : "todo bien");
process.exit(fails ? 1 : 0);
