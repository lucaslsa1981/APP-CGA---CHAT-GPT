# APP CGA · CGA/DRA/PCCE

Portal e aplicações de gestão de ativos da Célula de Gestão de Ativos (DRA/PCCE).

Versão: **2026.10.08**

## Download, GitHub, pasta de rede e Google Drive no Windows

Veja `IMPLANTACAO.md` para instalar no computador central ou numa pasta do Google Drive para computador. Execute `Preparar-Download.ps1` para gerar o ZIP limpo, sem bases e usuários reais. O pacote também pode ser usado como conteúdo de um repositório GitHub de distribuição. A versão de trabalho atual contém dados versionados: não a publique sem revisão.

## Executar localmente para aperfeiçoamento

Requer Node.js 18 ou superior. Não é necessário instalar pacotes.

1. Dê dois cliques em `Iniciar-CGA.cmd` ou execute `npm start` nesta pasta.
2. Abra **http://127.0.0.1:8080** no Chrome ou Edge.
3. Mantenha o terminal aberto durante o uso. Para encerrar, pressione Ctrl+C.
4. Após editar um arquivo, atualize a página. O servidor não mantém cache.

Execute `npm run check` para verificar a sintaxe dos scripts JavaScript clássicos e os arquivos JSON. Essa verificação não substitui os testes de interface e dos módulos compilados pelo empacotador.

Use sempre o mesmo endereço, porta e perfil do navegador: o armazenamento local pertence à origem. Os dados usados anteriormente por `file://` ou GitHub Pages não são automaticamente transferidos para localhost. Faça uma cópia de segurança pelo Portal antes de migrar. A sincronização em pasta e a integração Google continuam usando os mecanismos já existentes; o servidor local apenas entrega os arquivos.

O servidor aceita conexões apenas deste computador e não representa uma implantação multiusuário. Veja `ANALISE-CODIGO.md` para as limitações e próximos passos.

### Simulação sem seleção de pastas

No servidor local, a sincronização usa automaticamente `.local/cga-dados.js`. Essa pasta é criada na primeira publicação do gestor master e está excluída do Git. Não há necessidade de escolher uma pasta ao entrar ou trocar de módulo. Os dados originais de `cga-dados.js` são usados até a primeira publicação local; não são sobrescritos. Reiniciar o servidor mantém os dados salvos na pasta `.local`.

As adaptações são aplicadas somente às páginas entregues por este servidor, inclusive aos scripts comprimidos nos HTML. A abertura direta dos HTML ou a hospedagem estática mantém o comportamento original de autorização de pasta. Não copie `.local` para um repositório público. Para validar a adaptação dos sete módulos, execute `node tools/check-local.cjs`.

Esse modo atende à simulação neste computador. Uma implantação para usuários em computadores diferentes requer servidor compartilhado e autenticação no servidor. O navegador não permite autorizar silenciosamente uma pasta arbitrária de rede.

## Arquivos

- `index.html`: abre o Portal
- `Portal CGA.dc.html`: login, painel inicial, taxa de custódia, usuários, fonte de dados, auditoria e atualizações
- `Gestao de Veiculos Judiciais.dc.html`
- `Gestao de Veiculos Administrativos ACT.dc.html`: inclui a coluna Nº SAJ-MPCE (campos, filtros e relatórios)
- `Gestao de Bens SENAD.dc.html`
- `Controle de Ativos Passiveis de Reversao.dc.html`: planilha PGA (imóveis, veículos, contas bancárias e soma total)
- `Gestao de Processos SUITE-SEI.dc.html`: cadastro de processos SUITE/SEI, linha do tempo, documentos e vínculos com os itens das demais aplicações
- `Gestao de Veiculos de Uso Institucional.dc.html`: base PLANILHA OFICIAL PCCE; exporta a planilha atualizada no formato original
- `cga-export.js`: exportação dos relatórios, despachos e ofícios em DOCX e XLSX (embutido em cada app; mantido como referência)
- `cga-auth.js`: módulo de acesso, versão e sincronização (já embutido em cada arquivo; mantido aqui como referência)
- `assets/`

Cada arquivo funciona sozinho e sem internet. Abra pela pasta compartilhada da rede ou publique no GitHub Pages (Settings → Pages → Branch `main`, pasta raiz).

## Como atualizar a versão

1. No Portal, em **Atualizações**, baixe o **pacote do sistema** como cópia de segurança.
2. Substitua os arquivos na **mesma pasta** (ou no mesmo repositório), mantendo **os mesmos nomes**.
3. Não renomeie nem mova a pasta: o navegador guarda os dados pelo endereço de onde o sistema é aberto.
4. Os usuários só fecham e reabrem o Portal. Acessos, bases, relatórios e despachos são mantidos automaticamente.

## Pasta de sincronização (Chrome ou Edge)

O gestor master vincula uma pasta da rede em **Atualizações**. Bases e acessos passam a ser publicados no arquivo `cga-estado.json` dessa pasta, e os usuários que vinculam a mesma pasta recebem as atualizações ao abrir o sistema.

Os dados das planilhas não vão para o repositório: ficam no navegador de cada computador e, se vinculada, na pasta de sincronização da rede.

## Sincronização com Google Planilhas (Veículos de Uso Institucional)

1. No Google Drive, abra o .xlsx da planilha oficial e use **Arquivo › Salvar como Planilhas Google**.
2. Na planilha convertida, **Extensões › Apps Script**: cole o conteúdo de `google-apps-script/PlanilhaOficialPCCE.gs` e troque `TROQUE-ESTA-CHAVE`.
3. **Implantar › Nova implantação › App da Web** (executar como você; acesso: qualquer pessoa).
4. No app, em **Fonte de dados › Sincronização online**, informe o endereço `/exec` e a chave.

## Implantação em rede (uma única vez, no computador do gestor master)

1. Copie esta pasta para a pasta compartilhada da rede.
2. Abra `Portal CGA.dc.html` por essa pasta no Chrome ou Edge e entre como gestor master.
3. Quando o navegador pedir, escolha **a mesma pasta compartilhada** e marque **"Permitir em todas as visitas"**.

A partir daí, tudo é automático. O sistema grava sozinho o arquivo `cga-dados.js` na pasta a cada base carregada, usuário cadastrado ou valor alterado, e confere a publicação sempre que o gestor master abre qualquer página. Os usuários só abrem o Portal por essa pasta e entram com usuário e senha, sem instalar nada nem baixar pacotes.

**Ao atualizar a versão:** basta substituir os arquivos deste pacote na pasta. O `cga-dados.js` não vem no pacote e nunca é sobrescrito; ele é mantido pelo próprio sistema.
