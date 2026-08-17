# Radar de Eventos

## O que é

Ferramenta para a área comercial da Azul descobrir eventos corporativos que
concentram público de fora da cidade-sede, e transformar cada um em uma
oportunidade de venda: fretamento de aeronave, bloco de assentos ou ativação
com a empresa organizadora.

## Quem usa

Uma analista comercial da Azul. Uma pessoa, não um time. Ela hoje descobre
eventos por acaso — soube do encontro do Bradesco que trouxe todas as filiais
depois que ele já tinha acontecido, e do AWS Summit tarde demais para montar
uma oferta. O trabalho dela é ligar para a empresa organizadora antes dos
concorrentes.

Não é usuária técnica. Não vai rodar comando, editar JSON nem entender score
sem explicação. Abre no navegador, olha, decide para quem ligar hoje.

## O problema real

Não existe fonte única de "todos os eventos do Brasil". O que existe é a agenda
de cada centro de convenções, publicada em site próprio, cada um com um formato.
A informação está disponível mas espalhada, e ninguém tem tempo de checar
doze sites por semana.

O segundo problema é ranking: mesmo com a lista completa, 105 eventos não dizem
por onde começar. Uma formatura e a maior feira solar da América Latina ocupam
o mesmo pavilhão. A ferramenta precisa separar as duas.

## Decisões já tomadas

- **Fonte:** raspagem automática de agendas de centros de convenções.
  Hoje: Expo Center Norte, São Paulo Expo, Distrito Anhembi, Pro Magno.
- **Hospedagem:** GitHub Pages, no GitHub pessoal do Caio. Não é sistema
  oficial da Azul — é ferramenta de trabalho não-oficial.
- **Consequência técnica:** site estático. O scraper roda por GitHub Actions
  e grava `dados/eventos.json`; a página só lê esse arquivo.
- **MVP:** eventos que ainda vão acontecer. Passado não interessa.

## O que decide o valor de um evento

Um evento vale para a Azul quando puxa gente de fora para a cidade-sede.
Os sinais, em ordem de peso:

1. **Porte** — público declarado, quantidade de edições, ocupação de pavilhões.
2. **Alcance** — feira "da América Latina" ou "nacional" traz voo; regional não.
3. **Perfil do organizador** — federação nacional, multinacional de tecnologia
   ou convenção de rede reúnem filiais do país inteiro. É o padrão Bradesco.
4. **Duração** — evento de vários dias implica hospedagem, logo viagem.

O prazo é medido à parte do potencial. Um evento gigante daqui a cinco dias
continua gigante — só não dá mais para vendê-lo. Misturar as duas coisas em
um número só esconde exatamente a informação que ela precisa.

## O que a interface precisa entregar

Ela abre a página com uma pergunta na cabeça: **para quem eu ligo hoje?**
A resposta tem que estar visível sem rolar, sem filtrar, sem aprender nada.

Tudo o mais — a lista completa, os filtros, o evento pequeno de novembro —
existe para quando ela já respondeu a primeira pergunta e quer planejar.

## Fora de escopo por enquanto

- Login, multiusuário, permissões.
- Dados de passageiro, tarifa ou malha da Azul.
- Fontes fora de São Paulo (nenhuma agenda raspável encontrada até agora).
- CRM completo. A marcação de contato é um lembrete pessoal, não um funil.
