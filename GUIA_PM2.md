# Guia de Implantação com PM2 - Zapsons

Este guia apresenta instruções detalhadas sobre como configurar, executar e manter os bots Zapsons e Gatti funcionando em um servidor utilizando PM2.

## Índice

1. [Configuração Inicial do Projeto](#1-configuração-inicial-do-projeto)
2. [Executando Localmente](#2-executando-localmente)
3. [Instalação e Configuração do PM2](#3-instalação-e-configuração-do-pm2)
4. [Gerenciando Processos com PM2](#4-gerenciando-processos-com-pm2)
5. [Configuração de Reinicialização Automática](#5-configuração-de-reinicialização-automática)
6. [Comandos Úteis e Dicas](#6-comandos-úteis-e-dicas)

---

## 1. Configuração Inicial do Projeto

### 1.1. Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior recomendada)
- **npm** (geralmente vem junto com o Node.js)
- **Git** (para clonar o repositório)

### 1.2. Clonando o Repositório

```bash
# Clone o repositório
git clone https://github.com/ApenasGabs/gatti.git

# Entre no diretório do projeto
cd gatti
```

### 1.3. Instalando Dependências

```bash
npm install
```

Este comando instalará todas as dependências necessárias listadas no `package.json`:

- `@whiskeysockets/baileys`: Biblioteca para integração com WhatsApp
- `cheerio`: Para scraping de páginas web
- `qrcode-terminal`: Para exibir QR codes no terminal

### 1.4. Estrutura do Projeto

O projeto possui dois bots principais:

- **`zapsons.js`**: Bot que responde a mensagens no WhatsApp com motivos traduzidos
- **`gatti.js`**: Bot que monitora publicações em um site e envia notificações via WhatsApp

### 1.5. Variáveis de Ambiente e Configurações

**Importante:** Os bots utilizam algumas configurações hardcoded que você pode precisar ajustar:

#### Para o Zapsons (`zapsons.js`):
- **`WPP_CHAT_ID`** (linha 15): ID do grupo do WhatsApp onde o bot responderá
  ```javascript
  const WPP_CHAT_ID = "120363132077830172@g.us";
  ```

#### Para o Gatti (`gatti.js`):
- **`TARGET_URL`** (linha 12): URL do site a ser monitorado
  ```javascript
  const TARGET_URL = "https://concursos.objetivas.com.br/informacoes/2568/";
  ```
- **`WPP_CHAT_ID`** (linha 23): ID do grupo para notificações
  ```javascript
  const WPP_CHAT_ID = "120363132077830172@g.us";
  ```

**Como obter o ID do grupo:**
1. Execute o bot uma vez
2. Envie uma mensagem no grupo desejado
3. Observe os logs do console que mostrarão o `Chat ID`
4. Atualize o código com o ID correto

### 1.6. Autenticação do WhatsApp

Na primeira execução, ambos os bots precisam ser autenticados com o WhatsApp:

1. Um QR code será exibido no terminal
2. Abra o WhatsApp no seu celular
3. Vá em **Configurações** > **Aparelhos conectados**
4. Escaneie o QR code exibido

As credenciais serão salvas em:
- `zapsons.js`: `.baileys_auth_zapsons/`
- `gatti.js`: `.baileys_auth/`

Essas pastas são criadas automaticamente e mantêm a sessão autenticada.

---

## 2. Executando Localmente

### 2.1. Executando o Zapsons

```bash
node zapsons.js
```

**O que ele faz:**
- Conecta ao WhatsApp
- Aguarda mensagens no grupo configurado
- Responde automaticamente com motivos traduzidos da API [naas.daniilmira.com](https://naas.daniilmira.com/no)

### 2.2. Executando o Gatti

```bash
node gatti.js
```

**O que ele faz:**
- Conecta ao WhatsApp
- Monitora o site configurado a cada 5 minutos
- Detecta alterações nas publicações (novos itens, removidos ou modificados)
- Envia notificações no grupo do WhatsApp quando há mudanças

### 2.3. Primeira Execução

Na primeira vez que executar cada bot:

1. O QR code será exibido no terminal
2. Escaneie com o WhatsApp
3. Aguarde a mensagem de confirmação: `✅ WhatsApp conectado!`
4. O bot começará a funcionar normalmente

**Dica:** Execute os bots localmente primeiro para garantir que tudo está funcionando antes de configurar o PM2.

---

## 3. Instalação e Configuração do PM2

### 3.1. O que é PM2?

PM2 é um gerenciador de processos para aplicações Node.js que oferece:

- ✅ Manter aplicações rodando em segundo plano
- ✅ Reiniciar automaticamente se ocorrer falha
- ✅ Gerenciar múltiplas aplicações simultaneamente
- ✅ Monitoramento de CPU e memória
- ✅ Logs centralizados
- ✅ Reinicialização automática no boot do servidor

### 3.2. Instalando o PM2

```bash
# Instalação global do PM2
npm install -g pm2
```

**Verificar a instalação:**

```bash
pm2 --version
```

### 3.3. Criando o Arquivo de Configuração (Recomendado)

Criar um arquivo de configuração facilita o gerenciamento de múltiplos processos. Crie um arquivo `ecosystem.config.js` na raiz do projeto:

```javascript
module.exports = {
  apps: [
    {
      name: "zapsons",
      script: "./zapsons.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "./logs/zapsons-error.log",
      out_file: "./logs/zapsons-out.log",
      time: true,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "gatti",
      script: "./gatti.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "./logs/gatti-error.log",
      out_file: "./logs/gatti-out.log",
      time: true,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
```

**Explicação das opções:**

- `name`: Nome identificador do processo
- `script`: Caminho do arquivo a ser executado
- `instances`: Número de instâncias (1 para bots)
- `autorestart`: Reinicia automaticamente se o processo falhar
- `watch`: Monitora mudanças nos arquivos (desabilitado para produção)
- `max_memory_restart`: Reinicia se ultrapassar o limite de memória
- `error_file` / `out_file`: Caminhos para os arquivos de log
- `time`: Adiciona timestamp nos logs

### 3.4. Criando o Diretório de Logs

```bash
mkdir -p logs
```

---

## 4. Gerenciando Processos com PM2

### 4.1. Iniciando os Bots

#### Usando o arquivo de configuração (Recomendado):

```bash
# Inicia todos os processos definidos no ecosystem.config.js
pm2 start ecosystem.config.js
```

#### Iniciando processos individuais:

```bash
# Iniciar apenas o Zapsons
pm2 start zapsons.js --name "zapsons"

# Iniciar apenas o Gatti
pm2 start gatti.js --name "gatti"
```

### 4.2. Verificando o Status dos Processos

```bash
pm2 status
```

ou

```bash
pm2 list
```

**Exemplo de saída:**
```
┌────┬────────┬─────────────┬─────────┬─────────┬──────────┬────────┐
│ id │ name   │ mode        │ ↺       │ status  │ cpu      │ memory │
├────┼────────┼─────────────┼─────────┼─────────┼──────────┼────────┤
│ 0  │ zapsons│ fork        │ 0       │ online  │ 0.3%     │ 45.2mb │
│ 1  │ gatti  │ fork        │ 0       │ online  │ 0.5%     │ 52.1mb │
└────┴────────┴─────────────┴─────────┴─────────┴──────────┴────────┘
```

### 4.3. Parando os Bots

```bash
# Parar todos os processos
pm2 stop all

# Parar um processo específico por nome
pm2 stop zapsons
pm2 stop gatti

# Parar um processo específico por ID
pm2 stop 0
```

### 4.4. Reiniciando os Bots

```bash
# Reiniciar todos os processos
pm2 restart all

# Reiniciar um processo específico
pm2 restart zapsons
pm2 restart gatti
```

### 4.5. Removendo Processos do PM2

```bash
# Remover um processo específico
pm2 delete zapsons
pm2 delete gatti

# Remover todos os processos
pm2 delete all
```

**Nota:** Remover um processo apenas o tira do gerenciamento do PM2, não desinstala a aplicação.

### 4.6. Visualizando Logs

```bash
# Ver logs de todos os processos
pm2 logs

# Ver logs de um processo específico
pm2 logs zapsons
pm2 logs gatti

# Ver apenas os erros
pm2 logs --err

# Limpar os logs
pm2 flush

# Ver logs em tempo real com filtro
pm2 logs --lines 100
```

### 4.7. Monitoramento em Tempo Real

```bash
# Abrir o monitor do PM2 (interface de linha de comando)
pm2 monit
```

Isso abrirá uma interface interativa mostrando:
- CPU e memória em tempo real
- Logs em tempo real
- Informações detalhadas de cada processo

Para sair, pressione `Ctrl + C`.

---

## 5. Configuração de Reinicialização Automática

Para garantir que os bots iniciem automaticamente quando o servidor for reiniciado, é necessário configurar o PM2 para iniciar no boot do sistema.

### 5.1. Gerando o Script de Startup

```bash
pm2 startup
```

Este comando detectará automaticamente seu sistema operacional e fornecerá um comando específico que você deve executar. Exemplo de saída:

```
[PM2] Init System found: systemd
[PM2] To setup the Startup Script, copy/paste the following command:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u seu_usuario --hp /home/seu_usuario
```

**Execute o comando fornecido pelo PM2** (será algo como mostrado acima, mas específico para seu sistema).

### 5.2. Salvando a Lista de Processos

Depois de iniciar todos os bots que você deseja que sejam gerenciados automaticamente:

```bash
# Inicie os processos primeiro
pm2 start ecosystem.config.js

# Salve a configuração atual
pm2 save
```

Este comando salva a lista atual de processos gerenciados. Agora, sempre que o servidor reiniciar, esses processos serão iniciados automaticamente.

### 5.3. Testando a Configuração

Você pode testar se a configuração está funcionando reiniciando o servidor:

```bash
# Reiniciar o servidor (cuidado!)
sudo reboot
```

Após o servidor voltar, verifique se os processos foram iniciados:

```bash
pm2 list
```

### 5.4. Removendo o Startup (se necessário)

Se você quiser desabilitar a inicialização automática:

```bash
pm2 unstartup
```

E siga as instruções fornecidas.

### 5.5. Atualizando a Configuração de Startup

Se você adicionar ou remover processos, não esqueça de atualizar a configuração salva:

```bash
# Após fazer mudanças nos processos
pm2 save
```

---

## 6. Comandos Úteis e Dicas

### 6.1. Resumo de Comandos PM2

| Comando | Descrição |
|---------|-----------|
| `pm2 start <script>` | Inicia um processo |
| `pm2 stop <nome\|id>` | Para um processo |
| `pm2 restart <nome\|id>` | Reinicia um processo |
| `pm2 reload <nome\|id>` | Recarrega sem downtime (para apps clusterizados) |
| `pm2 delete <nome\|id>` | Remove um processo do PM2 |
| `pm2 list` | Lista todos os processos |
| `pm2 status` | Mostra o status dos processos |
| `pm2 logs` | Exibe logs em tempo real |
| `pm2 monit` | Interface de monitoramento |
| `pm2 save` | Salva lista de processos |
| `pm2 startup` | Configura inicialização automática |
| `pm2 unstartup` | Remove inicialização automática |
| `pm2 flush` | Limpa todos os logs |
| `pm2 describe <nome\|id>` | Informações detalhadas de um processo |

### 6.2. Dicas Importantes

#### Autenticação do WhatsApp
- **Problema:** Se os bots perderem a autenticação, será necessário escanear o QR code novamente.
- **Solução:** 
  1. Pare o processo: `pm2 stop zapsons` (ou `gatti`)
  2. Execute manualmente: `node zapsons.js`
  3. Escaneie o QR code
  4. Pare com `Ctrl + C`
  5. Inicie novamente com PM2: `pm2 start zapsons`

#### Verificação de Erros
Se um bot não estiver funcionando:

```bash
# Ver descrição detalhada e últimos erros
pm2 describe zapsons

# Ver logs de erro
pm2 logs zapsons --err --lines 50
```

#### Atualizando o Código
Quando você atualizar o código do projeto:

```bash
# 1. Puxar as últimas mudanças
git pull origin main

# 2. Instalar novas dependências (se houver)
npm install

# 3. Reiniciar os processos
pm2 restart all
```

#### Backup das Credenciais
As credenciais do WhatsApp são salvas em:
- `.baileys_auth_zapsons/`
- `.baileys_auth/`

**Importante:** Faça backup dessas pastas regularmente para não precisar reautenticar!

```bash
# Exemplo de backup
tar -czf baileys-backup-$(date +%Y%m%d).tar.gz .baileys_auth* 
```

#### Monitoramento de Recursos
Para verificar o uso de CPU e memória:

```bash
pm2 status
```

Se um processo estiver usando muita memória, você pode configurar o `max_memory_restart` no `ecosystem.config.js`.

#### Configurando ID do Grupo
Para obter o ID do grupo correto:

1. Execute o bot manualmente: `node zapsons.js` ou `node gatti.js`
2. Envie uma mensagem no grupo desejado
3. Observe os logs, que mostrarão:
   ```
   📨 Mensagem recebida:
      De: 120363132077830172@g.us
      Chat ID: 120363132077830172@g.us
   ```
4. Copie esse ID e atualize no código
5. Reinicie o processo com PM2

### 6.3. Troubleshooting Comum

#### Problema: PM2 não encontra o Node.js após reboot
**Solução:** Certifique-se de que o comando `pm2 startup` foi executado corretamente com as permissões adequadas.

#### Problema: Bot desconecta constantemente do WhatsApp
**Solução:** 
- Verifique sua conexão com a internet
- Certifique-se de que não há outra instância do bot rodando
- Exclua as pastas `.baileys_auth*` e reautentique

#### Problema: Logs crescem muito
**Solução:** Configure rotação de logs no PM2:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### Problema: Processo em modo "errored"
**Solução:**
```bash
# Ver o erro
pm2 logs <nome> --err --lines 50

# Reiniciar
pm2 restart <nome>

# Se persistir, remover e iniciar novamente
pm2 delete <nome>
pm2 start ecosystem.config.js
```

---

## Conclusão

Com este guia, você deve ser capaz de:

✅ Configurar o projeto Zapsons/Gatti do zero  
✅ Executar os bots localmente para testes  
✅ Instalar e configurar o PM2  
✅ Gerenciar os processos (iniciar, parar, reiniciar)  
✅ Configurar reinicialização automática no boot do servidor  
✅ Monitorar e solucionar problemas comuns  

**Importante:** Sempre teste suas mudanças localmente antes de aplicar em produção!

Para mais informações sobre o PM2, consulte a [documentação oficial](https://pm2.keymetrics.io/docs/usage/quick-start/).

---

**Contribuições:**
Se você encontrar problemas ou tiver sugestões para melhorar este guia, abra uma issue no repositório!
