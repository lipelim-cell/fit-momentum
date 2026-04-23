# 🏋️ FIT MOMENTUM

**Personal Trainer AI com WhatsApp Business API**

Sistema completo de automação para Personal Trainers que gera treinos personalizados com IA, envia vídeos demonstrativos e gerencia clientes pelo WhatsApp.

---

## 🚀 FUNCIONALIDADES

✅ **Geração de Treinos com IA (Claude)**
- Treinos 100% personalizados baseados no perfil do aluno
- Adaptação automática de intensidade por feedback
- Progressão inteligente ao longo do tempo

✅ **Envio Automático pelo WhatsApp**
- Mensagens formatadas profissionalmente
- Vídeos demonstrativos de cada exercício
- Botões interativos para respostas rápidas

✅ **Sistema de Planos**
- Básico (R$ 49/mês)
- Premium (R$ 97/mês)
- Elite (R$ 197/mês)

✅ **Automação Completa**
- Envio de treinos diários às 6h
- Coleta de feedback pós-treino
- Ajuste automático de dificuldade
- Mensagens motivacionais

---

## 📋 PRÉ-REQUISITOS

- Node.js 18+ instalado
- Conta Railway.app (gratuita)
- Conta Anthropic (Claude API)
- WhatsApp Business API configurado

---

## ⚡ INSTALAÇÃO RÁPIDA

### 1. Clone o projeto
```bash
git clone https://github.com/seu-usuario/fit-momentum.git
cd fit-momentum
```

### 2. Instale dependências
```bash
npm install
```

### 3. Configure variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 4. Configure o banco de dados
```bash
npm run migrate
npm run seed
```

### 5. Inicie o servidor
```bash
npm run dev
```

---

## 🔧 CONFIGURAÇÃO DETALHADA

### 1️⃣ **Railway (PostgreSQL + Redis)**

```bash
# 1. Criar conta em railway.app
# 2. Criar novo projeto
# 3. Adicionar PostgreSQL
# 4. Adicionar Redis
# 5. Copiar URLs geradas
```

Adicione no `.env`:
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### 2️⃣ **Claude API (Anthropic)**

```bash
# 1. Criar conta em console.anthropic.com
# 2. Gerar API key
# 3. Copiar chave
```

Adicione no `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 3️⃣ **WhatsApp Business API**

**Opção A: Meta (Facebook)**
1. Acesse: developers.facebook.com
2. Crie app WhatsApp Business
3. Configure webhook: `https://seu-dominio.com/webhook/whatsapp`
4. Copie: Phone Number ID e Access Token

**Opção B: Twilio**
1. Acesse: twilio.com/whatsapp
2. Configure número
3. Configure webhook

Adicione no `.env`:
```env
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_VERIFY_TOKEN=seu_token_secreto
```

---

## 📁 ESTRUTURA DO PROJETO

```
fit-momentum/
├── src/
│   ├── config/
│   │   ├── database.js          # Conexão PostgreSQL
│   │   └── redis.js             # Conexão Redis
│   │
│   ├── services/
│   │   ├── ai/
│   │   │   └── workoutGenerator.js   # Gera treinos com Claude
│   │   ├── whatsapp/
│   │   │   ├── messageHandler.js     # Processa mensagens
│   │   │   └── messageSender.js      # Envia mensagens
│   │   └── video/
│   │       └── videoDatabase.js      # Banco de vídeos
│   │
│   ├── models/
│   │   ├── User.js              # Model de usuário
│   │   └── Workout.js           # Model de treino
│   │
│   ├── routes/
│   │   ├── webhook.js           # Rotas de webhook
│   │   └── api.js               # Rotas da API
│   │
│   ├── jobs/
│   │   └── dailyWorkoutSender.js    # Cron: envio diário
│   │
│   ├── utils/
│   │   └── logger.js            # Sistema de logs
│   │
│   └── app.js                   # Aplicação principal
│
├── database/
│   ├── schema.sql               # Schema do banco
│   └── seed.sql                 # Dados iniciais
│
├── .env.example                 # Exemplo de variáveis
├── package.json                 # Dependências
└── README.md                    # Este arquivo
```

---

## 🧪 TESTANDO LOCALMENTE

### 1. Usando ngrok (webhook local)

```bash
# Instalar ngrok
npm install -g ngrok

# Expor porta 3000
ngrok http 3000

# Copiar URL gerada (ex: https://abc123.ngrok.io)
# Configurar como webhook no WhatsApp
```

### 2. Testar webhook

```bash
# Servidor rodando
npm run dev

# Em outro terminal, simular mensagem:
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5511999999999",
            "text": { "body": "Olá" }
          }]
        }
      }]
    }]
  }'
```

---

## 🚀 DEPLOY EM PRODUÇÃO

### Railway (Recomendado)

```bash
# 1. Instalar CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Inicializar
railway init

# 4. Deploy
railway up

# 5. Adicionar variáveis de ambiente no painel Railway
```

### Variáveis necessárias no Railway:
```
NODE_ENV=production
DATABASE_URL=(auto-gerado)
REDIS_URL=(auto-gerado)
ANTHROPIC_API_KEY=sk-ant-xxxxx
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=xxxxx
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_VERIFY_TOKEN=seu_token
```

---

## 📊 MONITORAMENTO

### Logs
```bash
# Ver logs em tempo real
tail -f logs/app.log

# Ou no Railway:
railway logs
```

### Métricas importantes
- Total de usuários ativos
- Taxa de conversão (lead → cliente)
- Taxa de conclusão de treinos
- Receita mensal recorrente (MRR)

---

## 🔐 SEGURANÇA

- ✅ Validação de webhook (WHATSAPP_VERIFY_TOKEN)
- ✅ Variáveis sensíveis em .env (não commitadas)
- ✅ SSL obrigatório em produção
- ✅ Rate limiting em endpoints
- ✅ Logs de auditoria

---

## 📈 ESCALABILIDADE

**Grátis (Railway):**
- ~500-1000 usuários
- 500MB PostgreSQL
- 256MB Redis

**Pago ($5/mês):**
- ~5000 usuários
- 8GB PostgreSQL
- 512MB Redis

**Produção (AWS/DO):**
- Ilimitado
- Auto-scaling

---

## 🐛 TROUBLESHOOTING

### Erro: "Connection refused PostgreSQL"
```bash
# Verificar se DATABASE_URL está correto
echo $DATABASE_URL

# Testar conexão
psql $DATABASE_URL
```

### Erro: "WhatsApp webhook não recebe mensagens"
```bash
# 1. Verificar se ngrok está rodando
# 2. Verificar se URL está correta no Meta
# 3. Verificar logs: railway logs
```

### Erro: "Claude API timeout"
```bash
# Verificar se ANTHROPIC_API_KEY está correto
# Verificar rate limits da API
```

---

## 🤝 CONTRIBUINDO

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📝 LICENÇA

MIT License - veja LICENSE para detalhes

---

## 📞 SUPORTE

- 📧 Email: suporte@fitmomentum.com
- 💬 WhatsApp: +55 11 99999-9999
- 📚 Docs: https://docs.fitmomentum.com

---

## 🎯 ROADMAP

- [x] Sistema de geração de treinos com IA
- [x] Integração WhatsApp Business API
- [x] Envio automático diário
- [x] Sistema de feedback e adaptação
- [ ] Dashboard admin
- [ ] Integração com pagamentos (Stripe)
- [ ] App mobile (React Native)
- [ ] Análise de vídeos de execução (visão computacional)
- [ ] Gamificação (badges, conquistas)
- [ ] Programa de indicação

---

**Desenvolvido com 💪 por Fit Momentum Team**
