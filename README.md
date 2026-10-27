# the relax club · site

o site do therelax.club. html estático + uma função serverless na vercel.

- `/` · sede (mixer de barulho + links)
- `/teste/` · quiz "qual cansaço é o seu?"
- `/artigos/` · índice dos artigos; cada artigo em `/artigos/<slug>/`
- `/sobre/` e `/news/` · "o que é a the relax club" e "o que é a the relax news" (mesmo template dos artigos)
- `/api/inscrever` · manda o contato e o resultado do quiz pro brevo
- `/perguntas/` redireciona pra `/sobre/` (vercel.json)

toda mudança enviada pro branch `main` publica sozinha no therelax.club.

variáveis de ambiente na vercel: `BREVO_API_KEY` e `BREVO_LIST_ID`.

## artigos

a fonte dos artigos é a base **Artigos do site** no notion. o build transforma cada artigo em html estático
(o texto já vem pronto no html, sem depender de javascript) e os arquivos gerados ficam commitados no repositório.
a vercel não roda build nenhum: ela só serve o que está no `main`.

o que o build gera ou atualiza:

- `artigos/index.html`, `artigos/<slug>/index.html` e `artigos/<slug>/og.png` (imagem de compartilhamento 1200x630)
- `sobre/` e `news/` (os artigos de slug `sobre` e `news`)
- o card "artigos · respostas curtas" da sede, entre os marcadores `<!-- artigos:inicio -->` e `<!-- artigos:fim -->` do `index.html` (até 4 artigos marcados "Destaque na home")
- os links "ler sobre" do resultado do teste (`LER_SOBRE`, entre marcadores no `teste/index.html`)
- `sitemap.xml` e `llms.txt` (entre marcadores)
- `conteudo/artigos.json`: snapshot da base do notion (propriedades + corpo em markdown), pra o build funcionar sem token

### rodar

```
npm run artigos:instalar     # uma vez (instala as dependências em scripts/artigos/)
npm run artigos              # normal: só artigos com status "Publicado"
npm run artigos:previa       # prévia: inclui também os que estão em "Revisão"
```

- com a variável `NOTION_TOKEN`, o build busca direto do notion e atualiza o snapshot. sem ela, usa `conteudo/artigos.json`.
- **no `main`, o build roda sempre sem a flag de prévia** (só "Publicado" vai pro ar). a prévia serve pra ver tudo numa branch de teste: a vercel gera uma url de prévia pra cada push fora do `main`.
- páginas de artigos em "Revisão" (só existem na prévia) saem com `noindex`.
- antes de juntar uma branch de prévia no `main`, rode `npm run artigos` (sem prévia) e commite. o workflow abaixo também faz isso sozinho quando o build muda no `main`.
- o artigo `sobre` precisa estar "Publicado": o rodapé e o redirect de `/perguntas` apontam pra `/sobre/`.

### automático (github actions)

`.github/workflows/artigos.yml` roda 1x por dia (e pelo botão "Run workflow" na aba actions): busca o notion,
gera só os publicados e, se algo mudou, commita no `main` (o que publica no site).
precisa do secret `NOTION_TOKEN` em settings > secrets and variables > actions, de uma integração do notion
compartilhada com as bases "Artigos do site" e "vídeos do youtube".

### propriedades usadas do notion

Título, Slug, Tipo, Status, Resposta curta, Capa (opcional, substitui a capa gerada), Capa animada,
Destaque na home, Publicado em (vira a data de "atualizado em"; vazio = 27/10/2026) e Vídeos do youtube
(relação; o vídeo aparece quando "Link do vídeo" está preenchido, junto com o adesivo "com vídeo").

### componentes

o template e as peças ficam em `scripts/artigos/build.mjs`, o visual em `css/artigos.css` e o comportamento em `js/artigos.js`:
resposta curta, player do youtube (capa leve, iframe só no clique), player "toca aqui" (toca o primeiro mix linkado
em "por onde começar", com timer de 30 min, e link "abre no mixer"), adesivo "com vídeo", capa gerada
(`scripts/artigos/capa.mjs`, determinística pelo slug), cards de teste, news e "volta pra sede".
os mixes e os arquivos de áudio do player vêm do próprio `index.html` (listas `MIXES` e `ARQ`).
