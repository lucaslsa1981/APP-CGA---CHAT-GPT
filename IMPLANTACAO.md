# Distribuição e implantação

## Pacote para download e GitHub

Execute `powershell -File .\Preparar-Download.ps1`. O ZIP em `dist/APP-CGA-download.zip` contém o aplicativo, iniciador e fontes de integração, sem usuários, bases ou estado da simulação. A pasta `.local` nunca entra no pacote. O workflow em `.github/workflows/package.yml` gera o download ao ser disparado manualmente ou por uma tag `v*`, depois de validar o código.

Os arquivos `cga-dados.js` e `cga-estado.json` da cópia de trabalho atual contêm dados e cadastros reais. Para criar um repositório público de distribuição, use o conteúdo do pacote limpo. Não publique a cópia de trabalho nem o histórico atual sem revisar os dados já versionados. Não substitua dados existentes de uma instalação por arquivos vazios ao atualizar: faça backup, substitua o código e preserve `.local`, `cga-dados.js` e `cga-estado.json`.

## Computador central e pasta compartilhada

1. Extraia o pacote limpo em uma pasta do computador central e compartilhe-a na rede.
2. Instale Node.js 18 ou superior em cada computador que executará o app.
3. Cada usuário inicia `Iniciar-CGA.cmd` pela mesma pasta compartilhada e abre `http://127.0.0.1:8080` no próprio computador. O iniciador aceita caminhos UNC usando `pushd`.
4. Na primeira configuração, o gestor master cadastra seu acesso e importa as bases pelo Portal. A publicação é gravada automaticamente em `.local/cga-dados.js` dentro da pasta central.
5. Os demais usuários recebem a publicação ao abrir o app. A pasta precisa permitir leitura para usuários e escrita para os gestores que publicam. Deixe apenas um gestor master publicando por vez nesta versão: a publicação é um snapshot e não uma transação de banco de dados.

O servidor de cada computador atende apenas localhost. Não é necessário abrir porta na rede nem escolher uma pasta no navegador. O servidor lê e grava a pasta de onde foi iniciado. O computador central precisa ficar ligado e a rede disponível. Se Node.js não estiver no PATH da sessão do usuário, ajuste a instalação do runtime.

A autenticação atual continua no navegador e não substitui as permissões Windows da pasta. Para controle confiável por usuário e gravação concorrente, migrar para backend com identidade e banco de dados. Esta distribuição não cria contas Windows, compartilhamentos ou regras de firewall automaticamente.

## Google Drive para computador

Guarde o pacote extraído em uma pasta do Google Drive para computador, disponibilize os arquivos offline e execute o iniciador pelo Windows. O app abre em localhost, não no visualizador do Drive. O Drive sincroniza os arquivos; não executa Node.js. Cada computador necessita Node.js.

Para evitar conflitos de sincronização, mantenha apenas o computador do gestor master publicando o estado. A sincronização do Drive não garante bloqueios nem transações entre computadores. Para trabalho simultâneo, use a versão online com backend, ou a pasta central com um único publicador, em vez de múltiplas cópias editando o mesmo estado no Drive.

## Acesso online pelo Google

Google Drive não oferece hospedagem web de HTML. Conforme a opção escolhida, este pacote usa Google Drive para computador e executa em localhost. Uma futura versão online exige Web App e backend, por exemplo com Apps Script. O script existente `google-apps-script/PlanilhaOficialPCCE.gs` sincroniza uma planilha específica; sozinho não hospeda os seis módulos.

Fontes: https://workspaceupdates.googleblog.com/2015/08/deprecating-web-hosting-support-in.html e https://developers.google.com/apps-script/guides/web
