# Pulso — Monitoramento de Pressão Arterial

Aplicação web pessoal para registrar e acompanhar medições de pressão arterial, com dashboard, relatórios em PDF e integração com n8n via Telegram.

---

## Rodar localmente

```bash
npm install
cp .env.example .env
# edite .env com seus valores
npm start
```

Acesse `http://localhost:3000`.

---

## Variáveis de ambiente

| Variável             | Descrição |
|----------------------|-----------|
| `PORT`               | Porta HTTP (default: 3000) |
| `NODE_ENV`           | `production` ou `development` |
| `DB_PATH`            | Caminho do arquivo SQLite (ex: `./data/pressao.db`) |
| `AUTH_USER`          | Nome de usuário para login no dashboard |
| `AUTH_PASSWORD_HASH` | Hash bcrypt da senha |
| `SESSION_SECRET`     | String aleatória para assinar o cookie de sessão |
| `API_KEY`            | Chave para autenticação das chamadas externas (n8n) |
| `PACIENTE_NOME`      | Nome exibido no cabeçalho do PDF (opcional) |

### Gerar o hash da senha

```bash
node -e "console.log(require('bcryptjs').hashSync('SUA_SENHA', 10))"
```

Cole o resultado em `AUTH_PASSWORD_HASH` no `.env`.

### Gerar `API_KEY` e `SESSION_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Execute duas vezes — uma para cada variável.

---

## Deploy no Easypanel

1. Crie um novo serviço a partir do repositório GitHub.
2. Easypanel detecta o `Dockerfile` automaticamente.
3. Configure as variáveis de ambiente na interface do serviço (aba "Environment").
4. Configure um **volume persistente** apontando para `/app/data` (onde o SQLite fica).
5. Salve e faça o deploy.

> O `DB_PATH` deve apontar para dentro do volume: `./data/pressao.db` (relativo a `/app`) ou `/app/data/pressao.db`.

---

## API

Todas as rotas `/api/*` requerem autenticação via header `x-api-key: SUA_API_KEY`.
Quando chamadas pelo próprio frontend (browser autenticado via sessão), o cookie de sessão também é aceito.

### `POST /api/medicoes`

Registra uma nova medição.

```json
{
  "sistolica": 128,
  "diastolica": 82,
  "bpm": 76,
  "medido_em": "2026-06-17T08:30:00",
  "observacao": "Antes do café da manhã",
  "origem": "n8n"
}
```

Campos obrigatórios: `sistolica`, `diastolica`. Retorna `201` com o registro criado e os campos `classificacao` e `alerta_crise`.

### `GET /api/medicoes?periodo=7d|30d|1a`

Lista medições do período em ordem cronológica.

### `GET /api/medicoes/resumo?periodo=7d|30d|1a`

Retorna médias e última medição do período. `alerta_crise: true` se a última medição for crise hipertensiva.

### `GET /api/medicoes/pdf?periodo=7d|30d|1a`

Gera e retorna um PDF com o relatório do período.

### `DELETE /api/medicoes/:id`

Remove uma medição pelo ID.

---

## Workflow n8n (Telegram)

1. Importe `n8n/workflow-telegram-pressao.json` no seu n8n.
2. Configure a credencial do bot do Telegram (token via @BotFather).
3. No node **POST /api/medicoes**, substitua `https://SEU-DOMINIO` pela URL pública do serviço.
4. Configure a credencial de API key (header `x-api-key` com o valor de `API_KEY`).
5. Ative o workflow.

**Formato de mensagem aceito:**

```
128/82 76 antes do café
```

- `128/82` → sistólica/diastólica (obrigatório)
- `76` → bpm (opcional)
- Texto restante → observação (opcional)
