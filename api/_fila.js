// fila de notificações que a clara decide mandar (a gente escreve junto no chat e eu coloco aqui).
// não tem página nem botão aberto: só manda o que estiver nesta lista, que só muda por commit no repositório.
// /api/fila/ (chamado de hora em hora pelo github actions, ou na hora depois do commit) manda cada item uma vez só,
// quando chegar o horário de "quando". depois de enviado, o item pode ficar aqui como histórico.
//
// formato:
//   { id: 'aaaa-mm-dd-assunto',            // único, nunca reaproveitar
//     titulo: '',                          // vazio: o iphone mostra "from the relax club" e a mensagem vem direto
//     texto: 'o que a gente quer dizer',   // até uns 120 caracteres pra caber inteiro na tela
//     url: '/',                            // onde abre ao tocar (link do site abre no app; link de fora abre no navegador)
//     quando: '2026-10-28T09:00:00-03:00' } // a partir de quando pode sair
export default [
  { id: '2026-10-27-teste', titulo: 'clara', texto: 'oi, só testando se chega direitinho por aqui. se chegou, deu certo.', url: '/', quando: '2026-10-27T12:40:00-03:00' },
  { id: '2026-10-27-teste-sem-titulo', titulo: '', texto: 'oi, agora sem título: só a mensagem e o nome do app embaixo.', url: '/', quando: '2026-10-27T13:16:00-03:00' },
];
