# Análise inicial do APP-CGA

## Estrutura encontrada

O projeto é um aplicativo web estático. `index.html` direciona ao Portal; seis páginas oferecem os módulos de gestão. Os HTML incluem um empacotador com manifestos, modelos e recursos embutidos. A autenticação e a exportação são copiadas para as páginas; os arquivos JS separados são descritos pelo README como referências. Alterar somente `cga-auth.js` ou `cga-export.js` não garante a atualização dos módulos.

`cga-auth.js` usa localStorage para usuários e sessão, IndexedDB para bases e mecanismos de publicação em pasta. `cga-dados.js` publica estado por uma variável global; `cga-estado.json` mantém estado de sincronização. Os dois arquivos Apps Script atendem a integração da planilha oficial.

## Ambiente preparado

- Servidor Node sem dependências, limitado a 127.0.0.1, com porta padrão 8080.
- Iniciador Windows e comandos npm para execução e verificação.
- Entrega de páginas, scripts conhecidos e recursos visuais de assets; arquivos de desenvolvimento e estado JSON não são publicados pelo servidor.
- Respostas sem cache para facilitar edição e atualização no navegador.
- Simulação com publicação automática em `.local/cga-dados.js`, sem seletor de pastas. O servidor adapta também os scripts comprimidos nos HTML; a pasta local é excluída do Git. Essa adaptação mantém o modelo de autenticação existente e não constitui autorização multiusuário em servidor.

## Pontos prioritários para aperfeiçoamento

1. **Autorização:** usuários, perfis e sessão ficam no navegador. As funções `saveUser` e `removeUser` da API de referência não verificam o perfil de quem as chama. As restrições de interface não constituem controle de acesso confiável para uma implantação compartilhada. Uma versão multiusuário precisa validar identidade e permissões no servidor.
2. **Senhas:** o código de referência usa SHA-256 com salt e um hash alternativo próprio. Para autenticação em servidor, substituir por derivação de senha apropriada, com parâmetros e migração definidos.
3. **Manutenção:** extrair fontes editáveis dos módulos e criar um processo de build antes de modificar em escala. Hoje há duplicação de código e extensos conteúdos serializados dentro dos HTML.
4. **Dados:** revisar o conteúdo publicado por `cga-dados.js` antes de qualquer hospedagem pública. Esse script é baixado pelo navegador e não depende da proteção visual do login. Definir backups, recuperação e regras para alterações simultâneas.
5. **Google Planilhas:** a chave começa como `TROQUE-ESTA-CHAVE`; a integração requer configuração real. O endpoint autoriza por chave compartilhada e recebe o nome do usuário no corpo enviado pelo cliente. Não há validação independente da identidade desse usuário no script analisado.
6. **Testes de uso:** validar primeiro cadastro/login, abertura dos seis módulos, importação, edição, exportações DOCX/XLSX, impressão e sincronização com dados de teste. O ambiente criado não modifica esses fluxos existentes.

## Limites desta análise

Foi feita uma análise estrutural e leitura dos módulos de autenticação e integração. A verificação de sintaxe cobre JSON, JS separados e scripts clássicos diretos dos HTML; ignora manifestos e templates do empacotador. Ela não valida o código compilado dinamicamente nem comprova o funcionamento dos relatórios, integrações ou persistência. Não foi realizado teste ponta a ponta com dados reais nem configurada a integração Google.
