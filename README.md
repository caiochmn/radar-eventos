# Radar de Eventos

Lista os eventos corporativos que vão acontecer em São Paulo e ordena por
potencial de venda de assentos ou fretamento — feiras nacionais, congressos de
federação e convenções de rede, que são os que trazem gente de fora.

As agendas são lidas automaticamente dos sites dos centros de convenções.
Nada é digitado à mão.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub e suba esta pasta:

```bash
git init && git add . && git commit -m "Radar de Eventos" && git branch -M main
```

2. Conecte ao repositório e envie:

```bash
git remote add origin https://github.com/SEU-USUARIO/radar-eventos.git && git push -u origin main
```

3. No GitHub, vá em **Settings → Pages**, escolha **Deploy from a branch**,
   branch `main` e pasta `/ (root)`. Em um ou dois minutos o site fica no ar em
   `https://SEU-USUARIO.github.io/radar-eventos/`.

4. Ainda em **Settings → Actions → General**, na seção *Workflow permissions*,
   marque **Read and write permissions**. Sem isso a atualização automática
   não consegue gravar o arquivo de eventos.

Pronto. A partir daí a agenda se atualiza sozinha duas vezes por dia.

## Rodar na sua máquina

Precisa de Node 20 ou mais novo. Não tem dependência para instalar.

```bash
npm run coletar
```

Lê todas as agendas e regrava `dados/eventos.json`.

```bash
npm run servir
```

Abre o site em `http://localhost:4178`. É necessário servir por HTTP —
abrir o `index.html` direto pelo Explorador de Arquivos não funciona, porque o
navegador bloqueia a leitura do JSON em `file://`.

## De onde vêm os eventos

| Fonte | Cidade | Como é lido |
|---|---|---|
| São Paulo Expo | São Paulo | Endpoint do calendário (o mesmo do botão "Carregar Mais") |
| Expo Center Norte | São Paulo | Página de eventos, agrupada por mês |
| Distrito Anhembi | São Paulo | Endpoint do calendário |
| Pro Magno | São Paulo | Lista de próximos eventos da home |

Riocentro e Fenac foram testados e descartados: publicam o nome do evento mas
não a data, nem na listagem nem na página interna, então não dá para saber
quando acontecem.

### Acrescentar uma fonte nova

Crie um arquivo em `scripts/fontes/` exportando `meta` e `coletar()`. O coletor
encontra sozinho qualquer arquivo nessa pasta — não precisa registrar em lugar
nenhum.

```js
export const meta = { id: 'minha-fonte', nome: 'Nome', cidade: 'Cidade', uf: 'UF', url: 'https://...' };
export async function coletar() {
  return [{ nome, descricao, dataInicio: '2026-09-10', dataFim: '2026-09-12', espaco, link }];
}
```

Se o site usar o plugin WordPress *Modern Events Calendar* (tem "Carregar Mais"
e "Ver Detalhes" na agenda), dá para reaproveitar o leitor pronto:

```js
import { criarLeitorMec } from '../lib/mec.mjs';
export const coletar = criarLeitorMec({ ajax: 'https://site/wp-admin/admin-ajax.php', paginaPublica: meta.url });
```

Para testar só uma fonte, sem regravar o arquivo de eventos:

```bash
npm run fonte -- sao-paulo-expo
```

## Como o potencial é calculado

Quatro componentes somam até 100. Nenhum deles usa a data — o prazo é medido
à parte, porque um evento gigante daqui a cinco dias continua gigante, só não
dá mais tempo de vendê-lo.

| Componente | Peso | O que observa |
|---|---|---|
| Porte | até 45 | Público declarado no texto, número de edições, ocupação de pavilhões, site próprio |
| Alcance | até 25 | "América Latina", "nacional", "internacional" |
| Perfil do organizador | até 28 | Federação nacional, multinacional de tecnologia, convenção de rede |
| Duração | até 8 | Evento de vários dias implica hospedagem, logo viagem |

Acima de 60 é **alto**, de 38 a 59 é **médio**, abaixo disso é **baixo**.
Eventos sociais privados são zerados.

Quando um evento não tem descrição publicada, só o nome é analisado e a nota
sai baixa por falta de informação, não por falta de potencial. Nesse caso a
interface mostra "Pouca informação" em vez de "Potencial baixo".

### Ajustar o cálculo

O arquivo `scripts/lib/sinais.mjs` existe para ser editado por quem conhece o
mercado. É onde ficam as listas de federações, multinacionais e padrões de
convenção de rede que o texto raspado não entrega sozinho. Acrescentar uma
linha lá muda o ranking sem mexer no motor.

## Limitações que valem saber

- **Só São Paulo por enquanto.** Foram testadas agendas de Curitiba, Belo
  Horizonte, Recife, Salvador, Fortaleza, Joinville e Novo Hamburgo; nenhuma
  publica dados legíveis por máquina. Vale revisitar de tempos em tempos.
- **O potencial é uma estimativa** a partir do texto que cada casa publica.
  Um evento enorme com descrição ruim vai pontuar baixo. Serve para ordenar a
  fila, não para decidir sozinho.
- **As marcações de contato ficam no navegador** de quem usa (localStorage).
  Não sincronizam entre pessoas nem entre computadores.
- **Se um site mudar de layout**, aquela fonte para de trazer eventos. O
  rodapé do site avisa quais fontes falharam na última coleta.

## Aviso

Ferramenta de trabalho não-oficial, hospedada em conta pessoal. Não é sistema
da Azul, não contém dado interno da companhia e lê apenas informação pública.
