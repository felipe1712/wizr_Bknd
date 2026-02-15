import { useState, useEffect, useCallback, useRef } from "react";
import { Maximize, Minimize, Grid3X3, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── slide data ─── */
const slides = [
  /* 1 — Portada */
  () => (
    <div className="flex flex-col overflow-hidden w-full h-full bg-[#F8FAFC]">
      <div className="h-2 w-full bg-gradient-to-r from-slate-900 to-slate-600" />
      <div className="flex-1 flex flex-col justify-between p-[60px]">
        <div className="flex flex-col gap-2">
          <span className="text-slate-500 uppercase tracking-[0.4em] text-[14px] font-bold">Taller de Capacitación</span>
          <div className="w-16 h-0.5 bg-slate-300" />
        </div>
        <div className="flex flex-col gap-10">
          <div className="flex gap-12 items-start">
            <div className="w-2 h-48 bg-slate-900 mt-2" />
            <div className="flex flex-col gap-6">
              <h1 className="text-[84px] leading-[1.05] font-extrabold text-slate-900 tracking-tight">
                Presencia Digital y<br />
                <span className="text-slate-700 font-light italic">Liderazgo Femenino</span>
              </h1>
              <p className="text-[30px] text-slate-600 max-w-[700px] font-normal leading-relaxed">
                Una herramienta de servicio para fortalecer el vínculo y el apoyo a la comunidad.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-end border-t border-slate-200 pt-8">
          <div className="flex flex-col">
            <span className="text-slate-400 text-[14px] uppercase tracking-widest font-semibold">Mensaje Clave</span>
            <span className="text-slate-800 text-[18px] font-medium">Comunicar para llegar a más mujeres.</span>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-slate-900 font-bold text-[18px] italic">16 de febrero de 2026</span>
            <span className="text-slate-400 text-[14px] uppercase tracking-wider">Secretaría de Promoción Política</span>
          </div>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-1/3 h-full opacity-[0.03] pointer-events-none flex flex-col justify-center items-center overflow-hidden">
        <span className="text-[400px] font-black leading-none select-none">DIGITAL</span>
      </div>
    </div>
  ),

  /* 2 — Reconocimiento */
  () => (
    <div className="flex flex-col w-full h-full bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] p-[60px_80px]">
      <div className="mb-12 border-l-4 border-slate-700 pl-6">
        <h1 className="text-[36px] font-bold text-slate-800 tracking-tight">Reconocimiento de su labor actual</h1>
      </div>
      <div className="grid grid-cols-2 gap-[60px] items-center flex-1">
        <div className="space-y-10">
          {[
            { icon: "fa-hands-helping", text: 'Su trabajo de <strong>gestión y acompañamiento</strong> es el pilar fundamental que sostiene a su comunidad.' },
            { icon: "fa-tools", text: 'La tecnología no busca sustituir su liderazgo, sino actuar como un <strong>complemento práctico</strong> a su esfuerzo.' },
            { icon: "fa-bullhorn", text: 'El compromiso con el <strong>servicio</strong> a otras mujeres sigue siendo el motor principal de su presencia pública.' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-5">
              <div className="mt-1 bg-slate-200 p-3 rounded-lg text-slate-700">
                <i className={`fas ${item.icon} fa-lg`} />
              </div>
              <p className="text-[24px] text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.text }} />
            </div>
          ))}
        </div>
        <div>
          <img alt="Mujeres líderes en comunidad" className="w-full h-[450px] object-cover rounded-lg shadow-lg" src="https://picture-search.skywork.ai/aippt/image/sheet/14444f7335621b317bbc9b0d3cb7fa7e.jpg" />
          <p className="mt-4 text-[14px] text-slate-500 italic text-right">El liderazgo se construye desde el contacto directo y el apoyo mutuo.</p>
        </div>
      </div>
      <div className="mt-auto pt-8 border-t border-slate-200">
        <p className="text-[20px] text-slate-600 font-medium">Partimos de la base de lo que ya hacen bien: servir a los demás.</p>
      </div>
    </div>
  ),

  /* 3 — Contexto actual */
  () => (
    <div className="flex flex-col w-full h-full bg-white">
      <div className="h-1.5 bg-slate-900 w-full" />
      <div className="flex flex-1">
        <div className="w-1/2 p-20 flex flex-col justify-center">
          <h2 className="text-slate-500 uppercase tracking-widest text-[14px] font-bold mb-2">Contexto Actual</h2>
          <h1 className="text-[48px] font-extrabold text-slate-900 mb-8 leading-tight">
            El cambio en el <br /><span className="text-slate-600 font-light">contacto ciudadano</span>
          </h1>
          <div className="space-y-8">
            <p className="text-[24px] text-slate-700 leading-relaxed">
              La interacción social ha migrado de las plazas y oficinas físicas hacia el <strong>entorno digital</strong>.
            </p>
            <div className="grid grid-cols-1 gap-6">
              <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-xl border-l-4 border-slate-300">
                <div className="text-slate-400 text-[30px] w-12 text-center"><i className="fas fa-door-open" /></div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[14px] font-bold uppercase">Antes</span>
                  <span className="text-slate-800 text-[20px] font-semibold">Búsqueda de ayuda presencial</span>
                </div>
              </div>
              <div className="flex items-center gap-6 p-6 bg-slate-900 rounded-xl border-l-4 border-slate-600">
                <div className="text-white text-[30px] w-12 text-center"><i className="fas fa-mobile-screen-button" /></div>
                <div className="flex flex-col">
                  <span className="text-slate-400 text-[14px] font-bold uppercase">Hoy</span>
                  <span className="text-white text-[20px] font-semibold">Primer contacto vía dispositivo móvil</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-1/2 relative bg-slate-100">
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl">
              <img alt="Personas usando celulares" className="w-full h-full object-cover" src="https://picture-search.skywork.ai/aippt/image/sheet/dd1fe1c4b93779c5206414459dba69d4.jpg" />
            </div>
          </div>
          <div className="absolute bottom-16 right-16 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-slate-600 text-[14px] font-medium">El 85% del contacto inicial ocurre ahora en plataformas digitales.</p>
          </div>
        </div>
      </div>
      <div className="px-20 py-8 border-t border-slate-100 flex justify-between items-center">
        <p className="text-slate-500 font-medium">La presencia digital no es una opción, es el <strong>nuevo espacio público</strong>.</p>
        <div className="h-1 w-12 bg-slate-200" />
      </div>
    </div>
  ),

  /* 4 — Celular como puerta */
  () => (
    <div className="flex flex-col w-full h-full bg-white">
      <div className="px-16 pt-12 pb-6">
        <h2 className="text-slate-500 uppercase tracking-widest text-[14px] font-bold mb-2">Acceso a la información</h2>
        <h1 className="text-[48px] font-extrabold text-slate-900 tracking-tight">El celular como puerta de entrada</h1>
        <div className="h-1.5 w-32 bg-slate-800 mt-4" />
      </div>
      <div className="flex-1 grid grid-cols-[1.2fr_1fr]">
        <div className="p-16 flex items-center justify-center">
          <div className="w-full h-full rounded-2xl overflow-hidden shadow-xl border border-slate-100">
            <img alt="Uso de smartphones" className="w-full h-full object-cover" src="https://picture-search.skywork.ai/aippt/image/sheet/5823cfcb66e0def5f5c466f9ccf047ca.jpg" />
          </div>
        </div>
        <div className="flex flex-col justify-center pr-24 pl-8 space-y-12">
          {[
            { icon: "fa-search", title: "Búsqueda de auxilio", text: 'Ante una crisis, el celular es el <strong>primer recurso</strong> para buscar ayuda, líneas de apoyo o refugio.' },
            { icon: "fa-mobile-alt", title: "Privacidad y seguridad", text: 'El dispositivo móvil ofrece un espacio de <strong>consulta discreto</strong> para mujeres en situaciones de vulnerabilidad.' },
            { icon: "fa-clock", title: "Inmediatez del servicio", text: 'La respuesta digital permite una <strong>atención prioritaria</strong> cuando el tiempo es un factor crítico.' },
          ].map((item, i) => (
            <div key={i} className="flex gap-6 items-start">
              <div className="bg-slate-50 p-4 rounded-lg text-slate-700"><i className={`fas ${item.icon} text-[24px]`} /></div>
              <div>
                <h3 className="text-[24px] font-bold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-[20px] text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.text }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-16 py-8 bg-slate-900 text-white flex justify-between items-center">
        <p className="text-[18px] font-medium">No es tecnología, es la vía más rápida para <strong>encontrar una solución</strong>.</p>
        <div className="text-slate-400 text-[12px] tracking-widest uppercase">Módulo 1: Entorno Digital</div>
      </div>
    </div>
  ),

  /* 5 — Ausencia digital */
  () => (
    <div className="flex flex-col w-full h-full bg-[#F8FAFC] p-[60px_80px]">
      <div className="mb-16">
        <h2 className="text-[14px] uppercase tracking-[0.3em] text-slate-500 font-bold mb-4">Impacto en el servicio</h2>
        <h1 className="text-[48px] font-extrabold text-slate-900 leading-tight">
          Consecuencias de la <span className="text-slate-600">ausencia digital</span>
        </h1>
        <div className="h-1.5 w-32 bg-slate-900 mt-6" />
      </div>
      <p className="text-[24px] text-slate-700 mb-12 max-w-[800px] leading-relaxed">
        Cuando el liderazgo no tiene presencia en red, se crean <strong>brechas de comunicación</strong> que afectan directamente a quienes buscan ayuda.
      </p>
      <div className="grid grid-cols-3 gap-8">
        {[
          { icon: "fa-eye-slash", title: "Invisibilidad en crisis", text: 'Para una mujer que busca apoyo desde su celular, lo que no aparece en pantalla <strong>simplemente no existe</strong>.' },
          { icon: "fa-search-location", title: "Dificultad de enlace", text: 'La falta de canales digitales obliga a la ciudadana a un <strong>esfuerzo físico o presencial</strong> que no siempre puede realizar.' },
          { icon: "fa-user-clock", title: "Respuesta tardía", text: 'Sin herramientas digitales, el tiempo entre la necesidad y el contacto se extiende, <strong>limitando la efectividad</strong> del apoyo.' },
        ].map((item, i) => (
          <div key={i} className="bg-white border border-slate-200 p-8 rounded shadow-sm flex flex-col gap-6">
            <div className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-800 rounded">
              <i className={`fas ${item.icon} text-[24px]`} />
            </div>
            <div>
              <h3 className="text-[20px] font-bold mb-3 text-slate-900">{item.title}</h3>
              <p className="text-slate-600 leading-snug text-[18px]" dangerouslySetInnerHTML={{ __html: item.text }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-10 border-t border-slate-200">
        <p className="text-slate-500 font-medium italic text-[18px]">La ausencia digital no es neutral; es una limitación real a nuestra capacidad de servicio.</p>
      </div>
    </div>
  ),

  /* 6 — Servicio vs vanidad */
  () => (
    <div className="flex flex-col w-full h-full bg-[#F8FAFC] p-[60px_80px]">
      <div className="mb-16">
        <h2 className="text-slate-500 uppercase tracking-widest text-[14px] font-bold mb-2">Estrategia y Propósito</h2>
        <h1 className="text-[48px] font-extrabold text-slate-900 tracking-tight">Servicio frente a vanidad</h1>
        <div className="w-20 h-1.5 bg-slate-900 mt-6" />
      </div>
      <div className="flex flex-1 gap-12 items-stretch">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-10 flex flex-col shadow-sm opacity-60">
          <div className="flex items-center gap-4 mb-8 text-slate-400">
            <i className="fas fa-user-circle text-[30px]" />
            <h3 className="text-[24px] font-bold uppercase tracking-tight">Vanidad Personal</h3>
          </div>
          <ul className="space-y-6 flex-1">
            {["Busca la <strong>exposición personal</strong> y el protagonismo individual.", "Se mide por la cantidad de <strong>likes o seguidores</strong> obtenidos.", "El contenido se centra en la <strong>imagen privada</strong> de la líder."].map((t, i) => (
              <li key={i} className="flex items-start gap-4">
                <i className="fas fa-times text-slate-300 mt-1" />
                <p className="text-[20px] text-slate-600" dangerouslySetInnerHTML={{ __html: t }} />
              </li>
            ))}
          </ul>
          <div className="mt-8 pt-6 border-t border-slate-100 italic text-slate-400 text-[14px]">No es el objetivo de este taller.</div>
        </div>
        <div className="flex-1 bg-slate-900 rounded-xl p-10 flex flex-col shadow-2xl">
          <div className="flex items-center gap-4 mb-8 text-white">
            <i className="fas fa-bullhorn text-[30px]" />
            <h3 className="text-[24px] font-bold uppercase tracking-tight">Servicio Institucional</h3>
          </div>
          <ul className="space-y-6 flex-1 text-white">
            {["Busca crear <strong>canales de atención</strong> y contacto para quienes necesitan ayuda.", "Se mide por la <strong>efectividad de la respuesta</strong> y la utilidad de la información.", "El contenido se centra en <strong>soluciones, trámites y acompañamiento</strong>."].map((t, i) => (
              <li key={i} className="flex items-start gap-4">
                <i className="fas fa-check text-slate-400 mt-1" />
                <p className="text-[20px]" dangerouslySetInnerHTML={{ __html: t }} />
              </li>
            ))}
          </ul>
          <div className="mt-8 pt-6 border-t border-slate-700 italic text-slate-400 text-[14px]">Enfoque central del liderazgo social moderno.</div>
        </div>
      </div>
      <div className="mt-12 flex items-center justify-center">
        <div className="bg-slate-100 px-8 py-4 rounded-full border border-slate-200">
          <p className="text-slate-700 text-[18px]">La presencia digital es un <strong>activo institucional</strong>, no un álbum personal.</p>
        </div>
      </div>
    </div>
  ),

  /* 7 — Beneficios prácticos */
  () => (
    <div className="flex flex-col w-full h-full bg-[#F8FAFC]">
      <div className="h-2 w-full bg-gradient-to-r from-slate-900 to-slate-600" />
      <div className="px-16 pt-16">
        <span className="text-slate-500 uppercase tracking-[0.3em] text-[12px] font-bold">Ventajas Estratégicas</span>
        <h1 className="text-[48px] font-extrabold text-slate-900 tracking-tight">Beneficios prácticos de la presencia</h1>
        <div className="w-20 h-1 bg-slate-900 mt-4" />
      </div>
      <div className="flex-1 px-16 flex items-center">
        <div className="grid grid-cols-3 gap-12 w-full">
          {[
            { icon: "fa-clock-rotate-left", title: "Optimización de respuesta", text: 'Permite atender solicitudes en el <strong>momento crítico</strong>, reduciendo los tiempos de espera y facilitando la <strong>gestión inmediata</strong>.' },
            { icon: "fa-map-location-dot", title: "Alcance territorial", text: 'Supera las barreras físicas para conectar con mujeres en <strong>zonas alejadas</strong> que difícilmente podrían acudir a una oficina.' },
            { icon: "fa-user-check", title: "Profesionalización", text: 'Una presencia digital organizada proyecta <strong>seriedad y confianza</strong>, elevando la calidad del servicio a la ciudadanía.' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col gap-6 p-8 bg-white border border-slate-200 shadow-sm rounded-sm">
              <div className="text-slate-800 text-[36px]"><i className={`fas ${item.icon}`} /></div>
              <div className="flex flex-col gap-4">
                <h3 className="text-[24px] font-bold text-slate-900">{item.title}</h3>
                <p className="text-[18px] text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.text }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-16 pb-16">
        <div className="bg-slate-900 p-6 flex items-center justify-between">
          <p className="text-white text-[20px] font-light italic">&quot;La tecnología no es el fin, es el medio para que el servicio sea más <strong>eficiente y accesible</strong>.&quot;</p>
          <span className="text-slate-400 text-[14px] font-bold uppercase tracking-widest">Utilidad Práctica</span>
        </div>
      </div>
    </div>
  ),

  /* 8 — Facebook y WhatsApp */
  () => (
    <div className="flex flex-col w-full h-full bg-white">
      <div className="h-1.5 bg-slate-600 w-full" />
      <div className="px-16 pt-12">
        <h2 className="text-slate-500 uppercase tracking-widest text-[14px] font-bold mb-2">Plataformas de Proximidad</h2>
        <h1 className="text-[48px] font-extrabold text-slate-900 tracking-tight">
          Facebook y WhatsApp: <span className="text-slate-600 font-light">Contacto cercano</span>
        </h1>
      </div>
      <div className="flex-1 grid grid-cols-12 gap-12 px-16 py-10 items-center">
        <div className="col-span-7 space-y-8">
          {[
            { icon: "fab fa-facebook-f", title: "Facebook: El Tablón Comunitario", items: ["Difusión de <strong>información útil</strong> y avisos oficiales.", "Espacio para resolver dudas en <strong>grupos locales</strong>.", "Registro visual del trabajo realizado en territorio."] },
            { icon: "fab fa-whatsapp", title: "WhatsApp: Atención Directa", items: ["Seguimiento <strong>personalizado</strong> de casos sensibles.", "Canal de confianza para <strong>orientación inmediata</strong>.", "Comunicación rápida con redes de apoyo vecinales."] },
          ].map((platform, i) => (
            <div key={i} className="flex gap-6 items-start p-6 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
              <div className="w-16 h-16 flex items-center justify-center bg-slate-200 rounded-full text-slate-700">
                <i className={`${platform.icon} text-[30px]`} />
              </div>
              <div>
                <h3 className="text-[24px] font-bold text-slate-800 mb-2">{platform.title}</h3>
                <ul className="text-slate-600 space-y-2 text-[18px]">
                  {platform.items.map((item, j) => (
                    <li key={j} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-white">
            <img alt="Contacto comunitario" className="w-full h-80 object-cover" src="https://picture-search.skywork.ai/aippt/image/sheet/46d2dc56bdfd5a821b70e9305a9256a4.jpg" />
          </div>
          <p className="text-slate-500 text-[14px] italic px-2">La tecnología es el puente que permite que el diálogo iniciado en persona continúe y se resuelva de forma eficiente.</p>
        </div>
      </div>
      <div className="px-16 pb-12">
        <div className="bg-slate-900 text-white p-6 rounded-lg flex justify-between items-center">
          <p className="text-[20px] font-medium">&quot;Estas herramientas no son para el entretenimiento, son para la <strong>gestión y el servicio</strong>.&quot;</p>
          <div className="h-8 w-[1px] bg-slate-500" />
          <p className="text-slate-400 text-[14px] uppercase tracking-widest font-bold">Utilidad Práctica</p>
        </div>
      </div>
    </div>
  ),

  /* 9 — Instagram y TikTok */
  () => (
    <div className="flex flex-col w-full h-full bg-white">
      <div className="h-2 w-full bg-gradient-to-r from-slate-900 to-slate-600" />
      <div className="pt-12 px-16 pb-8">
        <span className="text-slate-400 uppercase tracking-[0.3em] text-[12px] font-bold">Herramientas Digitales</span>
        <h1 className="text-[48px] font-extrabold text-slate-900 mt-2">
          Instagram y TikTok: <span className="text-slate-500 font-light">Visibilidad generacional</span>
        </h1>
      </div>
      <div className="flex-1 flex px-16 gap-12 items-center">
        <div className="w-1/2 space-y-10">
          <p className="text-[24px] text-slate-700 leading-relaxed">
            Estas plataformas permiten conectar con <strong>mujeres jóvenes</strong> y mostrar el impacto real del trabajo comunitario de forma visual y directa.
          </p>
          <div className="grid grid-cols-1 gap-8">
            {[
              { icon: "fab fa-instagram", title: "Narrativa Visual", text: 'Ideal para documentar <strong>casos de éxito</strong>, eventos y el día a día de la gestión mediante imágenes de alta calidad.' },
              { icon: "fab fa-tiktok", title: "Alcance Orgánico", text: 'Permite que el mensaje de servicio llegue a audiencias que <strong>no conocen su labor</strong>, superando las barreras del círculo cercano.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-6 border-l-4 border-slate-200 pl-6">
                <div className="text-slate-800 text-[30px] mt-1"><i className={item.icon} /></div>
                <div>
                  <h3 className="text-[20px] font-bold text-slate-900">{item.title}</h3>
                  <p className="text-slate-600 mt-2 leading-snug" dangerouslySetInnerHTML={{ __html: item.text }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2 flex flex-col gap-6">
          <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-100">
            <img alt="Conexión Generacional" className="w-full h-auto object-cover" src="https://picture-search.skywork.ai/aippt/image/sheet/aaa6aa6800daafbb61057bbbab199f90.jpg" />
          </div>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
            <h4 className="text-slate-800 font-bold mb-2">El enfoque correcto:</h4>
            <p className="text-slate-600 text-[14px] italic">
              No se busca ser &quot;influencer&quot;, sino <strong>dar testimonio</strong> de que la ayuda existe y es accesible para las nuevas generaciones.
            </p>
          </div>
        </div>
      </div>
      <div className="py-8 px-16 flex justify-between items-center bg-slate-50 border-t border-slate-100">
        <span className="text-slate-400 text-[14px] font-medium tracking-wide italic">Taller: Presencia Digital y Liderazgo Femenino</span>
        <div className="h-1 w-32 bg-slate-200" />
      </div>
    </div>
  ),

  /* 10 — Google: búsqueda urgente */
  () => (
    <div className="flex flex-col w-full h-full bg-white overflow-hidden">
      <div className="pt-12 px-16">
        <h1 className="text-[36px] font-bold text-slate-800 tracking-tight">Google: La búsqueda de ayuda urgente</h1>
        <div className="h-1 w-24 bg-slate-600 mt-4" />
      </div>
      <div className="flex-1 flex flex-col justify-center px-24 gap-16">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full max-w-3xl bg-slate-50 p-5 px-8 flex items-center gap-4 border border-slate-200 shadow rounded-full">
            <i className="fas fa-search text-slate-400 text-[20px]" />
            <span className="text-[20px] text-slate-600 font-light italic">&quot;Ayuda inmediata para mujeres en...&quot;</span>
          </div>
          <p className="text-slate-500 text-[14px] font-medium tracking-wide uppercase">El primer paso en una situación de crisis es la búsqueda digital</p>
        </div>
        <div className="grid grid-cols-2 gap-12">
          <div className="flex flex-col gap-6 p-8 bg-slate-50 rounded-xl border-l-4 border-slate-800">
            <div className="flex items-center gap-3">
              <i className="fas fa-clock text-slate-700 text-[24px]" />
              <h2 className="text-[24px] font-bold text-slate-800">Respuesta Crítica</h2>
            </div>
            <p className="text-[20px] text-slate-600 leading-relaxed">
              En momentos de <strong>emergencia o vulnerabilidad</strong>, las mujeres buscan soluciones locales inmediatas desde su dispositivo móvil.
            </p>
          </div>
          <div className="flex flex-col gap-6 p-8 bg-slate-50 rounded-xl border-l-4 border-slate-400">
            <div className="flex items-center gap-3">
              <i className="fas fa-map-marker-alt text-slate-700 text-[24px]" />
              <h2 className="text-[24px] font-bold text-slate-800">Visibilidad de Servicio</h2>
            </div>
            <ul className="text-[18px] text-slate-600 space-y-3">
              <li>• Ubicación de <strong>refugios y centros de apoyo</strong>.</li>
              <li>• Horarios y <strong>teléfonos de contacto</strong> directo.</li>
              <li>• Acceso a <strong>asesoría legal</strong> y acompañamiento.</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="bg-slate-900 py-10 px-24 flex items-center justify-between">
        <p className="text-white text-[24px] font-light">
          No aparecer en Google es, para una mujer en crisis, <span className="text-slate-300 font-bold italic">no existir como opción de ayuda.</span>
        </p>
        <i className="fas fa-shield-alt text-slate-400 text-[30px]" />
      </div>
    </div>
  ),

  /* 11 — Desmitificando la complejidad */
  () => (
    <div className="flex flex-col w-full h-full bg-white overflow-hidden">
      <div className="pt-12 px-16 flex justify-between items-end">
        <div>
          <h1 className="text-[36px] font-extrabold text-slate-900 tracking-tight">Desmitificando la complejidad técnica</h1>
          <div className="h-1 w-24 bg-slate-800 mt-4" />
        </div>
        <p className="text-slate-500 font-semibold uppercase tracking-widest text-[14px] mb-1">Estrategia Digital</p>
      </div>
      <div className="flex-1 px-16 py-12 grid grid-cols-12 gap-8 items-center">
        <div className="col-span-7 space-y-6">
          <p className="text-[20px] text-slate-600 mb-8 leading-relaxed">
            La presencia digital efectiva no depende de la sofisticación tecnológica, sino de la <strong>claridad del mensaje</strong> y la <strong>disponibilidad para ayudar</strong>.
          </p>
          <div className="grid grid-cols-1 gap-4">
            {[
              { icon: "fa-user-slash", title: 'No es ser "Influencer"', desc: 'Se trata de ser <strong>encontrable y útil</strong>, no de buscar fama personal o "likes" masivos.' },
              { icon: "fa-tools", title: "No requiere expertiz técnica", desc: "Las herramientas actuales son <strong>intuitivas</strong>. Lo importante es el contenido de valor que ya generan." },
              { icon: "fa-camera", title: "No exige estética perfecta", desc: "La <strong>autenticidad</strong> y la información veraz superan a la edición profesional en el liderazgo social." },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-shrink-0 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <i className={`fas ${item.icon} text-slate-400 text-[24px]`} />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-slate-800">{item.title}</h3>
                  <p className="text-slate-600" dangerouslySetInnerHTML={{ __html: item.desc }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl overflow-hidden shadow-xl border-4 border-slate-50">
            <img alt="Mujeres trabajando" className="w-full h-64 object-cover" src="https://picture-search.skywork.ai/aippt/image/sheet/775598a185beb72197ca5b325ec7d571.jpg" />
          </div>
          <div className="bg-slate-900 p-6 rounded-2xl text-white">
            <p className="text-[14px] uppercase tracking-widest font-bold text-slate-400 mb-2">Principio Rector</p>
            <p className="text-[18px] font-medium leading-snug">
              &quot;La tecnología es solo el canal; la <strong>capacidad de servicio</strong> sigue siendo su mayor activo.&quot;
            </p>
          </div>
        </div>
      </div>
      <div className="h-16 px-16 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[12px] font-semibold uppercase tracking-widest">
        <span>Presencia Digital y Liderazgo Femenino</span>
        <span>Módulo de Herramientas Técnicas</span>
      </div>
    </div>
  ),

  /* 12 — Espacio público digital */
  () => (
    <div className="flex flex-col w-full h-full bg-white p-16 overflow-hidden">
      <header className="mb-12">
        <h1 className="text-[48px] font-extrabold text-slate-900 tracking-tight">El espacio público digital</h1>
        <div className="h-1.5 w-20 bg-slate-800 mt-4" />
      </header>
      <div className="flex gap-12 items-start flex-1">
        <div className="w-7/12 space-y-10">
          <p className="text-[24px] text-slate-600 leading-relaxed">
            Lo digital no es un mundo aparte; es la <strong>extensión actual</strong> del espacio público donde se construye la participación ciudadana y la incidencia política.
          </p>
          <div className="grid grid-cols-1 gap-8">
            {[
              { icon: "fa-landmark", title: "Incidencia en la agenda", text: "Estar presentes permite que las <strong>causas comunitarias</strong> locales formen parte de la conversación pública general." },
              { icon: "fa-users-rectangle", title: "Representación efectiva", text: "Garantiza que la <strong>voz de las mujeres</strong> esté representada en los espacios donde se toman las decisiones hoy." },
              { icon: "fa-network-wired", title: "Construcción colectiva", text: "Facilita la creación de <strong>redes de apoyo</strong> y alianzas estratégicas entre líderes de distintas regiones." },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded text-slate-700 shrink-0">
                  <i className={`fas ${item.icon} text-[20px]`} />
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-slate-800 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-[18px]" dangerouslySetInnerHTML={{ __html: item.text }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-5/12">
          <div className="bg-slate-50 p-4 rounded-xl shadow-sm border border-slate-100">
            <img alt="Liderazgo femenino" className="rounded-lg shadow-md w-full h-auto object-cover" src="https://picture-search.skywork.ai/aippt/image/sheet/697197ecf69e1bc3af388b02fd20c225.jpg" />
            <div className="mt-4 px-2">
              <p className="text-[14px] text-slate-400 font-semibold tracking-widest uppercase">Participación e Incidencia</p>
              <p className="text-slate-500 text-[14px] mt-1">La presencia digital es hoy un componente esencial del liderazgo político moderno.</p>
            </div>
          </div>
        </div>
      </div>
      <footer className="mt-auto pt-8 border-t border-slate-100 flex justify-between items-center">
        <span className="text-slate-400 text-[14px] font-medium uppercase tracking-widest">Presencia Digital y Liderazgo Femenino</span>
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <span className="h-1 w-8 bg-slate-900" />
          <span>Herramienta de Servicio</span>
        </div>
      </footer>
    </div>
  ),

  /* 13 — Ser encontradas */
  () => (
    <div className="flex flex-col w-full h-full bg-[#F8FAFC] p-20 overflow-hidden">
      <div className="flex items-center gap-6 mb-12">
        <div className="w-1.5 h-16 bg-slate-900" />
        <h1 className="text-[48px] font-extrabold text-slate-900 tracking-tight">
          El objetivo central: <span className="text-slate-600 font-light">Ser encontradas</span>
        </h1>
      </div>
      <div className="flex flex-1 gap-16">
        <div className="w-1/2 flex flex-col justify-center gap-10">
          <p className="text-[24px] text-slate-700 leading-relaxed font-medium">
            La presencia digital no busca notoriedad, sino <strong>disponibilidad</strong>. Aseguramos que ninguna mujer se quede sin apoyo por falta de contacto.
          </p>
          <div className="space-y-8">
            {[
              { icon: "fa-search-location", title: "Ubicación Inmediata", text: 'Reducir el tiempo entre la <strong>necesidad de ayuda</strong> y el primer contacto con la líder.' },
              { icon: "fa-shield-heart", title: "Puente de Confianza", text: 'Ser el <strong>referente seguro</strong> que aparece cuando una mujer busca orientación en su celular.' },
              { icon: "fa-user-clock", title: "Respuesta Oportuna", text: 'Estar presentes donde las nuevas generaciones y mujeres en crisis <strong>buscan soluciones</strong> hoy.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-5">
                <div className="text-slate-400 mt-1"><i className={`fas ${item.icon} text-[30px]`} /></div>
                <div>
                  <h3 className="text-[20px] font-bold text-slate-800">{item.title}</h3>
                  <p className="text-slate-600" dangerouslySetInnerHTML={{ __html: item.text }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2 flex flex-col justify-center">
          <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-200">
            <img alt="Líder comunicando" className="w-full h-[340px] object-cover" src="https://picture-search.skywork.ai/aippt/image/sheet/aab97924ddbe95be6c29a0b08b959f85.jpg" />
          </div>
          <p className="mt-4 text-[14px] text-slate-500 italic text-right">La comunicación efectiva es la base del liderazgo de servicio.</p>
        </div>
      </div>
      <div className="mt-8 bg-slate-900 text-white p-8 rounded-lg flex items-center gap-8">
        <div className="bg-slate-700 p-4 rounded-full"><i className="fas fa-bullseye text-[24px] text-slate-200" /></div>
        <p className="text-[20px] font-medium leading-snug">
          &quot;La presencia digital no es exposición personal. Es una forma de <strong>servicio</strong> que permite que más mujeres encuentren <strong>apoyo a tiempo</strong>.&quot;
        </p>
      </div>
    </div>
  ),

  /* 14 — Compromiso */
  () => (
    <div className="flex flex-col w-full h-full bg-white overflow-hidden">
      <div className="px-16 pt-12 pb-8 flex justify-between items-center border-b border-slate-100">
        <div>
          <h1 className="text-[36px] font-extrabold text-slate-900 tracking-tight">La presencia digital como compromiso</h1>
          <p className="text-slate-500 text-[18px] mt-1">Extensión del servicio y la vocación</p>
        </div>
        <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400">Conclusión del Taller</span>
      </div>
      <div className="flex-1 flex flex-col justify-center px-16 gap-12">
        <div className="grid grid-cols-3 gap-8">
          {[
            { icon: "fa-handshake", title: "Extensión del Servicio", text: 'No es una tarea extra, es llevar su <strong>vocación de ayuda</strong> a los espacios donde las mujeres están hoy.' },
            { icon: "fa-route", title: "Eliminar Distancias", text: 'Lo digital permite que una mujer en una zona remota o aislada <strong>pueda contactarlas</strong> sin barreras físicas.' },
            { icon: "fa-clock", title: "Respuesta Oportuna", text: 'Estar presente significa que la ayuda llega en el <strong>momento crítico</strong>, cuando más se necesita.' },
          ].map((item, i) => (
            <div key={i} className="flex flex-col gap-4 p-8 border border-slate-100 bg-slate-50 rounded-lg">
              <div className="text-slate-700 text-[30px]"><i className={`fas ${item.icon}`} /></div>
              <h3 className="text-[20px] font-bold text-slate-900">{item.title}</h3>
              <p className="text-slate-600 leading-relaxed text-[18px]" dangerouslySetInnerHTML={{ __html: item.text }} />
            </div>
          ))}
        </div>
        <div className="bg-slate-900 text-slate-100 p-10 rounded-xl shadow-xl flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="h-0.5 w-12 bg-slate-400" />
            <span className="uppercase tracking-[0.3em] text-[14px] font-bold text-slate-400">Mensaje Final</span>
          </div>
          <p className="text-[30px] font-light italic leading-snug">
            &quot;La presencia digital <strong>no es exposición personal</strong>. Es una forma de servicio que permite que más mujeres encuentren <strong>apoyo a tiempo</strong>.&quot;
          </p>
        </div>
      </div>
      <div className="px-16 py-8 flex justify-between items-center text-slate-400 text-[14px]">
        <span>Presencia Digital y Liderazgo Femenino</span>
      </div>
    </div>
  ),

  /* 15 — Transición al ejercicio práctico */
  () => (
    <div className="flex flex-col w-full h-full bg-[#F8FAFC] overflow-hidden">
      <div className="h-2 w-full bg-slate-900" />
      <div className="flex-1 flex flex-col p-16 justify-between">
        <div className="flex flex-col gap-4">
          <span className="text-slate-500 uppercase tracking-widest text-[14px] font-bold">Cierre de fase teórica</span>
          <h1 className="text-[48px] font-extrabold text-slate-900 leading-tight">Transición al ejercicio práctico</h1>
          <div className="w-24 h-1.5 bg-slate-800" />
        </div>
        <div className="grid grid-cols-3 gap-8 my-12">
          {[
            { icon: "fa-mobile-alt", title: "Configuración", text: 'Ajuste de perfiles institucionales para que la <strong>información de contacto</strong> sea clara y accesible.' },
            { icon: "fa-tools", title: "Herramientas", text: 'Uso de mensajes automáticos y respuestas rápidas para la <strong>atención oportuna</strong>.' },
            { icon: "fa-handshake", title: "Canales de Ayuda", text: 'Vinculación de plataformas para asegurar que el <strong>puente de servicio</strong> esté siempre abierto.' },
          ].map((item, i) => (
            <div key={i} className="bg-white border border-slate-200 p-8 rounded-lg flex flex-col gap-4">
              <div className="text-slate-700 text-[30px]"><i className={`fas ${item.icon}`} /></div>
              <h3 className="text-[20px] font-bold text-slate-800">{item.title}</h3>
              <p className="text-slate-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.text }} />
            </div>
          ))}
        </div>
        <div className="bg-slate-900 p-10 rounded-lg text-white">
          <p className="text-[24px] font-light leading-snug">
            &quot;La presencia digital no es exposición personal. <br />Es una <strong>forma de servicio</strong> que permite que más mujeres encuentren <strong>apoyo a tiempo</strong>.&quot;
          </p>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-700">
            <span className="text-slate-400 font-semibold tracking-widest text-[14px] uppercase">Iniciamos Parte Práctica</span>
            <span className="px-4 py-2 bg-white text-slate-900 font-bold text-[14px]">MANOS A LA OBRA</span>
          </div>
        </div>
      </div>
    </div>
  ),
];

/* ─── presentation viewer ─── */
export default function LiderazgosPresentation() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const total = slides.length;

  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, Math.min(idx, total - 1)));
    setShowGrid(false);
  }, [total]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  /* keyboard */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen?.();
      if (e.key === "g" || e.key === "G") setShowGrid(v => !v);
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, isFullscreen]);

  /* fullscreen */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* scale computation */
  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.min(w / 1280, h / 720));
    };
    compute();
    const obs = new ResizeObserver(compute);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [showGrid]);

  const SlideComponent = slides[current];

  if (showGrid) {
    return (
      <div ref={containerRef} className={`${isFullscreen ? "bg-slate-950" : "bg-slate-100 min-h-screen"} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-700">
            Todas las láminas ({total})
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowGrid(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {slides.map((Slide, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:ring-2 hover:ring-slate-400 ${
                idx === current ? "border-slate-900 ring-2 ring-slate-500" : "border-slate-200"
              }`}
            >
              <div className="absolute inset-0 origin-top-left" style={{ width: 1280, height: 720, transform: `scale(${Math.min(320 / 1280, 180 / 720)})` }}>
                <Slide />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center font-bold">
                {idx + 1}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center ${isFullscreen ? "bg-black w-screen h-screen" : "bg-slate-100 min-h-screen"}`}
      style={{ cursor: "default" }}
    >
      {/* Scaled slide */}
      <div
        ref={slideRef}
        className="absolute overflow-hidden rounded-lg shadow-2xl"
        style={{
          width: 1280,
          height: 720,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          left: "50%",
          top: "50%",
          marginLeft: -640,
          marginTop: -360,
        }}
      >
        <SlideComponent />
      </div>

      {/* Controls overlay */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 backdrop-blur border border-slate-200 rounded-full px-4 py-2 shadow-lg z-50 transition-opacity ${isFullscreen ? "opacity-0 hover:opacity-100" : ""}`}>
        <Button variant="ghost" size="icon" onClick={prev} disabled={current === 0} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-bold text-slate-700 min-w-[60px] text-center">
          {current + 1} / {total}
        </span>
        <Button variant="ghost" size="icon" onClick={next} disabled={current === total - 1} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-[1px] h-5 bg-slate-200" />
        <Button variant="ghost" size="icon" onClick={() => setShowGrid(true)} className="h-8 w-8" title="Grid (G)">
          <Grid3X3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8" title="Fullscreen (F)">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>

      {/* Click navigation zones */}
      <div className="absolute inset-0 flex z-10">
        <div className="w-1/3 h-full cursor-pointer" onClick={prev} />
        <div className="w-1/3 h-full" />
        <div className="w-1/3 h-full cursor-pointer" onClick={next} />
      </div>
    </div>
  );
}
