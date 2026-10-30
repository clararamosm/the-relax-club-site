// conteúdo e regras da cadência do teste e do clube (os emails que saem depois do email 1).
// quem manda é /api/cadencia (chamado de hora em hora pelo workflow "avisos").

// 'teste': a cadência está ligada, mas só manda pro email de teste da clara (pelo link de teste); ninguém de fora recebe.
// 'todos': manda pra todo mundo que chegou no dia. troca pra 'todos' só depois da clara aprovar os testes.
export const MODO = 'todos'; // liberada pela clara em 29/10/2026
export const LIGADA = MODO === 'todos';
export const TESTE_PARA = 'clara@therelax.club';

// modelos no brevo (transacionais, remetente clara@therelax.club)
export const TEMPLATE_SONS = 14; // "quiz · 02 · sons"
export const TEMPLATE_APP = 15;  // "quiz · 03 · app" (teste e clube)

// quantos dias depois de cada passo sai o próximo email
export const DIAS_SONS = 3;        // depois do teste
export const DIAS_APP_DEPOIS_SONS = 4; // depois do email dos sons
export const DIAS_APP_CLUBE = 3;   // depois de entrar no clube (o email de boas-vindas sai na hora)

// contas da clara: nunca entram na cadência automática
export const INTERNOS_DOMINIO = ['therelax.club', 'boldfy.com.br', 'operos.ai', 'example.com', 'b.com'];
export const INTERNOS_EMAIL = ['mathaeusnora@gmail.com', 'therelaxclub.br@gmail.com'];


// o mix de cada cansaço (o mesmo que aparece no email dos sons e é citado no email do app)
export const MIXES = {
  'físico':     { nome: 'dormir', sons: 'praia, ventilador e grilos', mix: 'dormir', texto: 'cansaço físico pede o corpo deitado e nada pra resolver. é esse que eu deixo tocando na hora de deitar.' },
  mental:       { nome: 'chuva em casa', sons: 'chuva, trovoada e gato ronronando', mix: 'chuva-em-casa', texto: 'cabeça cheia acalma com um som que não muda. a chuva cobre os barulhos pequenos que puxam a atenção.' },
  emocional:    { nome: 'noite no sítio', sons: 'sapos, grilos e lareira', mix: 'noite-no-sitio', texto: 'quando pesa o que você tá segurando, ajuda um som de casa de vó. bom pra ouvir parada ou enquanto escreve o que sente.' },
  social:       { nome: 'varanda', sons: 'kalimba, cigarra e vento', mix: 'varanda', texto: 'bateria social recarrega com tempo sozinha, sem ninguém pedindo nada. dez minutos disso antes de abrir as mensagens.' },
  sensorial:    { nome: 'só o ventilador', sons: 'um som só, baixinho', mix: 'ventilador-35', texto: 'pra você eu não vou mandar mix: sentido cansado pede um som só, sem surpresa. o ventilador cobre a rua e a casa sem acrescentar nada.', soUm: true },
  criativo:     { nome: 'chuva musical', sons: 'pau de chuva, kalimba e chuva', mix: 'chuva-musical', texto: 'criatividade gosta de um pouco de novidade no fundo. eu ponho esse quando preciso sair do jeito de sempre.' },
  espiritual:   { nome: 'meditar', sons: 'tigela cantando, sininhos e cachoeira', mix: 'meditar', texto: 'a tigela tem um som longo que segura a atenção numa coisa só. cinco minutos de olho fechado, sem regra nenhuma.' },
  em_dia:       { nome: 'fim de tarde no interior', sons: 'cigarra, vento, sino e passarinhos', mix: 'fim-de-tarde-no-interior', texto: 'suas baterias tão em dia, então esse som é pra manter assim.' },
  espalhado:    { nome: 'serra', sons: 'flauta, cachoeira e passarinhos', mix: 'serra', texto: 'quando o cansaço tá espalhado, começa pelo mais simples: natureza.' }
};

const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function mixDe(at) {
  if (at.PERFIL === 'em_dia' || at.PERFIL === 'espalhado') return { chave: at.PERFIL, ...MIXES[at.PERFIL] };
  const amb = at.AMBITO || at.DESCANSO_PRINCIPAL || '';
  const chave = Object.keys(MIXES).find(k => sem(k) === sem(amb));
  return chave ? { chave, ...MIXES[chave] } : null;
}
const nomeVirgula = (at) => { const n = String(at.NOME || '').trim().split(/\s+/)[0]; return n ? ', ' + n.toLowerCase() : ''; };

// parâmetros do email dos sons
export function paramsSons(at) {
  const m = mixDe(at);
  if (!m) return null;
  const camp = 'cadencia-sons-' + sem(m.chave).replace(/[^a-z]+/g, '-');
  const abertura = m.chave === 'em_dia' ? 'no teste, as suas baterias vieram em dia. hoje eu quero te mostrar um som pra manter assim.'
    : m.chave === 'espalhado' ? 'no teste, o seu cansaço apareceu espalhado por várias baterias. hoje eu quero te mostrar um som pra começar.'
    : `no teste, o seu cansaço principal foi o ${m.chave}. hoje eu quero te mostrar um som pra ele.`;
  return {
    ASSUNTO: (m.chave === 'em_dia' || m.chave === 'espalhado') ? 'o som que eu escolheria pra você agora' : `o som que eu escolheria pro seu cansaço ${m.chave}`,
    TITULO: (m.chave === 'em_dia' || m.chave === 'espalhado') ? 'um som pra' : 'um som pro seu cansaço',
    TITULO_ITALICO: (m.chave === 'em_dia' || m.chave === 'espalhado') ? 'você agora' : m.chave,
    NOME_VIRGULA: nomeVirgula(at),
    ABERTURA: abertura,
    MIX_NOME: m.nome, MIX_SONS: m.sons, MIX_TEXTO: m.texto,
    MIX_SLUG: m.mix,
    CAMPANHA: camp,
    MOTIVO: 'fez o teste dos 7 tipos de descanso'
  };
}

// parâmetros do email do app (origem: 'teste' ou 'clube')
export function paramsApp(at, origem) {
  const m = mixDe(at);
  const linha = !m ? 'os mixes prontos ficam a um toque.'
    : m.soUm ? 'o ventilador fica a um toque.'
    : `o seu mix ${m.nome} fica a um toque.`;
  return {
    NOME_VIRGULA: nomeVirgula(at),
    MIX_LINHA: linha,
    CAMPANHA: origem === 'clube' ? 'cadencia-app-clube' : 'cadencia-app-teste',
    MOTIVO: origem === 'clube' ? 'entrou no clube' : 'fez o teste dos 7 tipos de descanso'
  };
}

const dias = (data, agora) => data ? Math.floor((agora - new Date(data + 'T12:00:00-03:00').getTime()) / 864e5) : -1;

// decide o próximo email de um contato: { qual: 'sons'|'app', origem } ou null
export function proximo(c, agora = Date.now()) {
  const email = String(c.email || '').toLowerCase();
  const at = c.attributes || {};
  if (c.emailBlacklisted) return null;
  if (INTERNOS_EMAIL.includes(email) || INTERNOS_DOMINIO.includes(email.split('@')[1])) return null;
  if (!(c.listIds || []).includes(3)) return null;
  if (at.QUIZ_AT) {
    if (!at.CAD_SONS_AT) return dias(at.QUIZ_AT, agora) >= DIAS_SONS && mixDe(at) ? { qual: 'sons', origem: 'teste' } : null;
    if (!at.CAD_APP_AT && dias(at.CAD_SONS_AT, agora) >= DIAS_APP_DEPOIS_SONS) return { qual: 'app', origem: 'teste' };
    return null;
  }
  if (at.CLUBE_AT && at.CLUBE_OPTIN && !at.CAD_APP_AT && dias(at.CLUBE_AT, agora) >= DIAS_APP_CLUBE) return { qual: 'app', origem: 'clube' };
  return null;
}
