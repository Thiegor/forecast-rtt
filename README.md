# Forecast de Receita Semanal — RTT Soluções Industriais

App React para coleta semanal de forecast de receita por gerentes de site.

## Stack
- **React** — interface
- **Supabase** — autenticação e banco de dados
- **GitHub Pages** — hospedagem

## Setup

### 1. Instalar dependências
```bash
npm install
```

### 2. Rodar localmente
```bash
npm start
```

### 3. Deploy no GitHub Pages

Edite o `package.json` e atualize o campo `homepage` com a URL do seu repositório:
```json
"homepage": "https://SEU_USUARIO.github.io/forecast-rtt/"
```

Instale o gh-pages se necessário:
```bash
npm install gh-pages --save-dev
```

Faça o deploy:
```bash
npm run deploy
```

## Supabase — Configuração

### Habilitar autenticação por email/senha
1. Acesse o painel do Supabase
2. **Authentication → Providers → Email**
3. Certifique-se que está habilitado
4. Desabilite "Confirm email" para facilitar o cadastro inicial

### Criar usuários
No SQL Editor do Supabase, execute para cada gerente:
```sql
-- Primeiro insira na tabela usuarios
INSERT INTO usuarios (email, nome, perfil) VALUES
('nome.sobrenome@rttshop.com.br', 'Nome Sobrenome', 'gestor');
```

Depois crie o usuário no Auth do Supabase:
**Authentication → Users → Add user**
- Email: nome.sobrenome@rttshop.com.br
- Password: (senha inicial — o gerente pode trocar depois)

### Sincronizar projetos
Quando a planilha de projetos mudar, execute:
```bash
python sincronizar_projetos.py
```

## Estrutura do projeto
```
src/
  App.js              — roteamento principal
  lib/supabase.js     — cliente Supabase
  hooks/
    useAuth.js        — autenticação
    useForecast.js    — dados do forecast
  pages/
    Login.js          — tela de login
    Forecast.js       — formulário principal
```
