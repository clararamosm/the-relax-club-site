// marca no contato do brevo por quais formulários a pessoa passou (campo FORMULARIOS, de múltipla escolha).
// cada formulário novo do site entra aqui: é só chamar marcarFormulario(brevo, email, 'nome-do-formulario').
// o campo aparece como coluna no brevo e dá pra filtrar e segmentar por ele.
export const CAMPO = 'FORMULARIOS';
export const CONHECIDOS = ['teste', 'clube', 'planner'];

let opcoesProntas = null; // cache por instância

async function garantirOpcao(brevo, form) {
  if (opcoesProntas && opcoesProntas.includes(form)) return;
  const r = await brevo('/contacts/attributes', 'GET');
  const attrs = (r.json ? r.json : (() => { try { return JSON.parse(r.text); } catch (e) { return {}; } })()).attributes || [];
  const atual = attrs.find(a => a.name === CAMPO && a.category === 'normal');
  if (!atual) {
    const opcoes = [...new Set([...CONHECIDOS, form])];
    await brevo(`/contacts/attributes/normal/${CAMPO}`, 'POST', { type: 'multiple-choice', multiCategoryOptions: opcoes });
    opcoesProntas = opcoes;
    return;
  }
  const tem = (atual.multiCategoryOptions || []).map(o => (typeof o === 'string' ? o : o.value || o.label));
  if (!tem.includes(form)) {
    const todas = [...new Set([...tem, ...CONHECIDOS, form])];
    const u = await brevo(`/contacts/attributes/normal/${CAMPO}`, 'PUT', { multiCategoryOptions: todas });
    if (!u.ok) await brevo(`/contacts/attributes/normal/${CAMPO}`, 'PUT', { multiCategoryOptions: [form] });
  }
  opcoesProntas = [...new Set([...tem, form])];
}

const lista = v => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/\s*,\s*/) : []);

// soma o formulário ao que a pessoa já tinha (nunca apaga os anteriores)
export async function marcarFormulario(brevo, email, form) {
  try {
    await garantirOpcao(brevo, form);
    const c = await brevo(`/contacts/${encodeURIComponent(email)}`, 'GET');
    let atual = [];
    try { atual = lista((c.json || JSON.parse(c.text)).attributes?.[CAMPO]); } catch (e) {}
    if (atual.includes(form)) return true;
    const u = await brevo(`/contacts/${encodeURIComponent(email)}`, 'PUT', { attributes: { [CAMPO]: [...atual, form] } });
    if (!u.ok) console.error('formularios', u.status, u.text);
    return u.ok;
  } catch (e) { console.error('formularios', e && e.message); return false; }
}

// quais formulários um contato já preencheu, pelos campos que ele tem (pra preencher quem entrou antes do campo existir)
export function formulariosPelosCampos(at = {}) {
  return [(at.QUIZ_AT || at.ULTIMO_TESTE_AT) ? 'teste' : null, at.MEMBRO_NUM != null ? 'clube' : null, (at.PLANNER_AT || at.PLANNER_ESPERA) ? 'planner' : null].filter(Boolean);
}
