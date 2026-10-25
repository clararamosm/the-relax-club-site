# the relax club · site

o site do therelax.club. html estático + uma função serverless na vercel.

- `/` · home (maré + links)
- `/teste/` · quiz "qual cansaço é o seu?"
- `/api/inscrever` · manda o contato e o resultado do quiz pro brevo

toda mudança enviada pro branch `main` publica sozinha no therelax.club.

variáveis de ambiente na vercel: `BREVO_API_KEY` e `BREVO_LIST_ID`.
