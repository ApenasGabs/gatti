# Gatti - Bots WhatsApp 🤖

Este repositório contém dois bots para WhatsApp desenvolvidos com Node.js:

## 🤖 Bots Disponíveis

### 1. **Zapsons** (`zapsons.js`)
Bot que responde automaticamente a mensagens em um grupo específico do WhatsApp.

**Funcionalidades:**
- Responde a todas as mensagens recebidas no grupo configurado
- Busca motivos aleatórios da API [naas.daniilmira.com](https://naas.daniilmira.com/no)
- Traduz automaticamente os motivos do inglês para português
- Formato de resposta: "Não posso responder. Motivo: [motivo traduzido]"

### 2. **Gatti** (`gatti.js`)
Bot que monitora publicações em um site e envia notificações via WhatsApp quando há alterações.

**Funcionalidades:**
- Monitora a página de publicações de concursos a cada 5 minutos
- Detecta novos itens, itens removidos e alterações em itens existentes
- Envia notificações detalhadas no WhatsApp com todas as mudanças
- Mantém um histórico (snapshot) das publicações para comparação
- Sistema de controle para evitar spam de notificações

## 📋 Pré-requisitos

- Node.js (versão 18 ou superior)
- npm (gerenciador de pacotes do Node.js)
- Uma conta do WhatsApp

## 🚀 Início Rápido

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar os IDs dos grupos

Edite os arquivos `zapsons.js` e `gatti.js` e atualize a constante `WPP_CHAT_ID` com o ID do seu grupo:

```javascript
const WPP_CHAT_ID = "SEU_ID_DE_GRUPO@g.us";
```

**Como obter o ID do grupo:**
1. Execute o bot uma vez
2. Envie uma mensagem no grupo desejado
3. Observe os logs - o ID será exibido

### 3. Executar os bots

**Zapsons:**
```bash
node zapsons.js
```

**Gatti:**
```bash
node gatti.js
```

Na primeira execução, um QR code será exibido. Escaneie-o com o WhatsApp para autenticar.

## 🔧 Execução em Produção

Para manter os bots rodando 24/7 em um servidor, recomendamos o uso do PM2.

### 📖 Guia Completo de Implantação

Criamos um guia detalhado sobre como implantar e gerenciar os bots com PM2:

👉 **[GUIA_PM2.md](./GUIA_PM2.md)** 👈

O guia inclui:
- ✅ Configuração inicial completa
- ✅ Instalação e configuração do PM2
- ✅ Gerenciamento de processos
- ✅ Configuração de reinicialização automática
- ✅ Troubleshooting e dicas úteis

### Início Rápido com PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar os bots
pm2 start ecosystem.config.js

# Ver status
pm2 status

# Configurar reinicialização automática
pm2 startup
pm2 save
```

## 📂 Estrutura do Projeto

```
gatti/
├── zapsons.js              # Bot de respostas automáticas
├── gatti.js                # Bot de monitoramento de publicações
├── ecosystem.config.js     # Configuração do PM2
├── package.json            # Dependências do projeto
├── GUIA_PM2.md            # Guia de implantação com PM2
├── README.md              # Este arquivo
├── data/                  # Diretório de dados
│   └── gatti-publicacoes.snapshot.json
└── logs/                  # Logs do PM2 (criado automaticamente)
```

## 🔐 Segurança

Os diretórios de autenticação do WhatsApp (`.baileys_auth` e `.baileys_auth_zapsons`) contêm informações sensíveis e **não devem ser compartilhados**.

**Importante:**
- Esses diretórios já estão no `.gitignore`
- Faça backup regular dessas pastas
- Nunca commite credenciais no Git

## 🛠️ Tecnologias Utilizadas

- **[@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)** - Biblioteca para integração com WhatsApp Web
- **[Cheerio](https://cheerio.js.org/)** - Web scraping (parsing HTML)
- **[qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal)** - Exibição de QR codes no terminal
- **[PM2](https://pm2.keymetrics.io/)** - Gerenciador de processos Node.js

## 📝 Customização

### Alterar intervalo de verificação (Gatti)

No arquivo `gatti.js`, linha 299:

```javascript
setInterval(scrapSite, 5 * 60 * 1000); // 5 minutos
```

Ajuste o valor para o intervalo desejado (em milissegundos).

### Alterar URL monitorada (Gatti)

No arquivo `gatti.js`, linha 12:

```javascript
const TARGET_URL = "https://concursos.objetivas.com.br/informacoes/2568/";
```

## 🐛 Troubleshooting

### Bot desconecta do WhatsApp

1. Pare o processo
2. Delete os diretórios `.baileys_auth*`
3. Execute novamente e escaneie o QR code

### Notificações duplicadas (Gatti)

O bot já possui proteção contra spam (2 minutos de cooldown). Se persistir:
- Verifique se não há múltiplas instâncias rodando
- Reinicie o processo com `pm2 restart gatti`

### Bot não responde (Zapsons)

1. Verifique se o `WPP_CHAT_ID` está correto
2. Confirme que o bot está autenticado
3. Verifique os logs: `pm2 logs zapsons`

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique o [GUIA_PM2.md](./GUIA_PM2.md) para soluções comuns
2. Abra uma issue no GitHub
3. Consulte os logs: `pm2 logs`

## 📄 Licença

MIT License - veja o `package.json` para mais detalhes.

## 👤 Autor

**Apenasgabs**
- GitHub: [@ApenasGabs](https://github.com/ApenasGabs)
- Email: Gabers357@gmail.com

---

**Nota:** Este projeto utiliza WhatsApp Web de forma não oficial. Use por sua conta e risco.
