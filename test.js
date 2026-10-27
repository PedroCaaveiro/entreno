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
ok(A.state.v === 10, "plan v10 por defecto");
ok(A.state.days[3].ex.map(e => e.id).join() === "e8,e10,e24,e32,e33,e34,e15", "Fuerza A: tirón y cadera");

ok(A.state.days[4].ex.map(e => e.id).join() === "e23,e31,e25,e30,e26,e21,e35,e14", "Fuerza B: pierna pesada y tirón");
ok(["e1","e5","e12","e20","e2","e4"].every(id => !A.findEx(id)), "fuera press, prensa vieja y abducción en máquina");
ok(A.state.days.map(d => d.wd.join()).join("|") === "1|3|5|6|0", "días: lun, mié, vie, sáb, dom");
ok(A.state.days.map(d => d.id).join() === "d1,d2,d4,d5,d6", "cinco días en el plan");
ok(A.findEx("e19").day.id === "d4" && !A.findEx("e29") && !A.findEx("e28"), "viernes fitboxing");
ok(A.state.days[0].ex.map(e => e.id).join() === "e36,e27,e16", "lunes: carrera, cinta y remo");
ok(A.state.days[1].ex.map(e => e.id).join() === "e22,e37,e38", "miércoles: intervalos, carrera y cinta");
ok(!A.dayForDate(new w.Date("2026-09-22T10:00:00")), "martes sin sesión");
ok(!A.dayForDate(new w.Date("2026-09-24T10:00:00")), "jueves sin sesión");
ok(A.dayForDate(new w.Date("2026-09-27T10:00:00")).name.indexOf("Fuerza B") === 0, "domingo = Fuerza B");
ok(A.dayForDate(new w.Date("2026-09-26T10:00:00")).name.indexOf("Fuerza A") === 0, "sábado = Fuerza A");
let hoy = w.document.getElementById("v-hoy").textContent;
ok(!hoy.includes("activación") && !hoy.includes("estiramientos") && !hoy.includes("Sesión"), "lunes sin activación ni estiramientos");
ok(w.document.getElementById("hdrDay").textContent === "Cardio + carrera", "lunes = cardio y carrera");
let missing = [];
A.state.days.forEach(d => d.ex.forEach(e => { if (e.ref && !A.REF[e.ref]) missing.push(e.ref); }));
A.MOV.act.concat(A.MOV.est).forEach(m => { if (!A.REF[m.ref]) missing.push(m.ref); });
ok(!missing.length, "todas las imágenes existen " + missing.join(","));

// 2. registro de remo
let r = A.logSession("e16", { cardio: { min: "12", m: "2400", spm: "26", ppm: "" } }, "2026-09-22");
ok(r && r.cardio.m === 2400 && r.cardio.ppm === "", "registro de remo guarda metros");
ok(A.setsText(r).indexOf("12 min · 2400 m · 26 p/min") === 0, "texto de remo: " + A.setsText(r));
ok(A.logSession("e16", { cardio: {} }) === null, "registro vacío no se guarda");
let c = A.logSession("e14", { cardio: { min: "30", kmh: "5", inc: "6", ppm: "118" } }, "2026-09-22");
ok(c.cardio.km === 2.5, "la cinta calcula los km: " + c.cardio.km);
ok(c.cardio.ppm === 118, "la cinta vuelve a guardar pulsaciones");
ok(A.setsText(c).indexOf("+150 m") !== -1, "desnivel en el texto: " + A.setsText(c));
let run = A.logSession("e36", { cardio: { min: "30", kmh: "9", inc: "1" } }, "2026-09-22");
ok(run.cardio.km === 4.5, "carrera: km desde min y velocidad = " + run.cardio.km);
ok(A.desnivel(run.cardio) === 45, "4,5 km al 1 % = 45 m, da " + A.desnivel(run.cardio));
let rw = A.logSession("e22", { cardio: { min: "20", m: "4000", spm: "26", ppm: "140", ppmx: "162" } }, "2026-09-22");
ok(rw.cardio.ppmx === 162, "el remo guarda la pulsación máxima");
let rc = A.resumenCardio(30);
ok(Math.abs(rc.kmCor - 4.5) < 0.01 && Math.abs(rc.kmAnd - 2.5) < 0.01, "resumen: " + rc.kmCor + " corridos, " + rc.kmAnd + " andados");
ok(rc.maxMin === 30 && rc.maxKmh === 9, "mejor carrera: " + rc.maxMin + " min a " + rc.maxKmh);
A.guardaPerfil("44", "170", "96", "107", "60", "180");
ok(A.zonaPpm(0.60, 0.70) === "132-144 ppm", "Karvonen zona 2: " + A.zona2());
ok(A.notaTxt("Zona 2 ({z2})").indexOf("132-144") !== -1, "las notas muestran la zona calculada");

// 3. hoja de ejercicio y de movilidad
A.setView("hoy");
w.document.querySelector('[data-ex="e36"]').click();
ok(w.document.querySelector("#c_km") && w.document.querySelector("#c_ppm"), "la carrera pide km y pulsaciones");
w.document.querySelector('[data-act="close"]').click();
ok(!w.document.querySelector("[data-mov]"), "sin tarjetas de activación");

// 4. editor: crear cardio de remo
let e = A.addExercise("d4", { name: "Remo extra", t: "c:remo", sets: 1, reps: "10 min" });
ok(e.t === "c" && e.cm === "remo", "nuevo ejercicio de remo");


ok(A.state.days.every(d => d.ex.every(e => e.cm !== "cinta" || /6 %|1 %/.test(e.note))), "cintas con pendiente indicada");

// 4b. alimentación
A.FOOD_WEEK.forEach((d, i) => {
  const miss = d.m.filter(id => !A.MEALS[id]);
  ok(!miss.length, "día " + i + " con comidas válidas " + miss.join(","));
  const tt = A.foodTotals(d.m);
  ok(tt.p >= 148 && tt.k >= 1700 && tt.k <= 2000, "día " + i + ": " + tt.k + " kcal, " + tt.p + " g");
});
A.setView("food");
ok(w.document.getElementById("hdrDay").textContent === "Lunes", "comida abre en el día de hoy");
w.document.querySelector('[data-meal="com_pasta"]').click();
ok(w.document.getElementById("v-food").textContent.includes("Hoy llevas 575 kcal y 45 g"), "marcar comida suma");
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
ok(A.state.v === 10 && A.state.days.length === 5, "plan viejo actualizado");
ok(A.state.logs.length === 2, "registros conservados");
ok(A.state.eaten && typeof A.state.eaten === "object", "estado viejo recibe registro de comidas");
ok(A.logsOf("e1")[0].sets[0].kg === 80, "historial de prensa intacto");
ok(A.setsText(A.state.logs[1]).indexOf("35 min") === 0, "cardio antiguo se lee: " + A.setsText(A.state.logs[1]));
ok(A.findEx("ek3x9z1ab") && A.findEx("ek3x9z1ab").day.id === "d1", "ejercicio propio conservado");
ok(w.localStorage.getItem("entreno.v1.copia-v1") !== null, "copia del plan viejo guardada");
ok(w.document.getElementById("hdrDay").textContent === "Descanso", "jueves = descanso");
ok(!w.document.getElementById("v-hoy").textContent.includes("Figura 4"), "descanso sin estiramientos");
A.setView("plan"); const pl = w.document.getElementById("v-plan").textContent;
ok(!pl.includes("Estiramientos") && !pl.includes("Activación"), "plan sin estiramientos ni activación");
["plan", "food", "hist", "set"].forEach(v => { A.setView(v); ok(w.document.getElementById("v-" + v).innerHTML.length > 50, "vista " + v); });

// 5b. usuario de una versión anterior
const v3 = JSON.parse(JSON.stringify(A.seed()));
v3.v = 9;
v3.days[0].ex.push({ id: "exmio", t: "f", name: "Mío", sets: 3, reps: "10" });
v3.logs = [{ id: "l9", exId: "e1", date: "2026-09-15", sets: [{ kg: 90, reps: 8 }] }];
let w2 = boot(v3, "2026-09-21T10:00:00");
ok(w2.APP.state.v === 10 && w2.APP.state.days[1].name.indexOf("Intervalos") === 0, "la versión anterior se actualiza al plan nuevo");
ok(w2.APP.findEx("exmio") && w2.APP.state.logs.length === 1, "ejercicio propio y registros conservados");

// 5c. pasos, perfil y grasa estimada
A.guardaPerfil("44", "170", "95", "108");
ok(A.state.perfil.altura === "170" && A.state.cuerpo[0].kg === 95, "perfil y peso guardados");
A.guardaPasos("2026-09-24", 10000, 0);
let g = A.gastoPasos(A.state.steps["2026-09-24"]);
ok(Math.abs(g.km - 7.055) < 0.01, "10.000 pasos andando = " + g.km.toFixed(2) + " km");
ok(Math.abs(g.kcal - 335) < 5 && g.grasa < 0.05, "gasto andando: " + Math.round(g.kcal) + " kcal");
A.guardaPasos("2026-09-24", 10000, 10000);
let gr = A.gastoPasos(A.state.steps["2026-09-24"]);
ok(gr.kcal > g.kcal * 2.4, "corriendo gasta bastante más: " + Math.round(gr.kcal) + " kcal");
ok(A.sumaPasos(7).pasos === 10000, "resumen semanal suma los días");
A.guardaPasos("2026-09-24", 0, 0);
ok(!A.state.steps["2026-09-24"] && A.sumaPasos(7).pasos === 0, "poner 0 borra el día");
ok(A.zona2() === "114-132 ppm", "zona 2 sin FC medida (por edad): " + A.zona2());
A.setView("hist");
ok(w.document.getElementById("hdrTitle").textContent === "Progreso", "pestaña renombrada a Progreso");
ok(w.document.getElementById("stT") && w.document.getElementById("v-hist").textContent.includes("Últimos 30 días"), "campos de pasos y resumen");
A.setView("set");
ok(w.document.getElementById("pfPeso").value === "95", "ajustes muestra el peso guardado");

// 5d. migración desde v9 con registros de ejercicios retirados
const v9 = { v: 9, days: [
  { id:"d1", name:"Fuerza A", wd:[1], ex:[
    { id:"e1", t:"f", name:"Prensa", sets:3, reps:"6-8" },
    { id:"e20", t:"f", name:"Patada de glúteo", sets:3, reps:"10-12" },
    { id:"e5", t:"f", name:"Abducción", sets:3, reps:"15" },
    { id:"exmio2", t:"f", name:"Mío", sets:3, reps:"10" } ] },
  { id:"d5", name:"Cinta", wd:[6], ex:[{ id:"e29", t:"c", cm:"cinta", name:"Cinta larga", sets:1, reps:"60" }] } ],
  logs: [ { id:"l1", exId:"e1", date:"2026-10-05", sets:[{kg:118,reps:8}] },
          { id:"l2", exId:"e20", date:"2026-09-28", sets:[{kg:35,reps:12}] },
          { id:"l3", exId:"e29", date:"2026-10-17", cardio:{min:80,kmh:5,inc:11} } ],
  eaten:{}, steps:{}, perfil:{edad:"44",altura:"170",peso:"96",cintura:"107"}, cuerpo:[] };
let w3 = boot(v9, "2026-10-26T10:00:00");
ok(w3.APP.state.v === 10, "v9 se actualiza a v10");
ok(w3.APP.state.logs.length === 3, "se conservan los registros de e1, e20 y e29");
ok(["e1","e5","e20","e29"].every(id => !w3.APP.findEx(id)), "los ejercicios retirados salen del plan");
ok(w3.APP.findEx("exmio2"), "el ejercicio propio se conserva");
w3.APP.setView("hist");
ok(w3.APP.state.logs.every(l => w3.APP.setsText(l).length > 3), "el historial sigue legible");

// 6. importar copia vieja
ok(A.importJSON(JSON.stringify(viejo)) && A.state.v === 10, "importar copia vieja la actualiza");

console.log(fails ? fails + " fallos" : "todo bien");
process.exit(fails ? 1 : 0);
