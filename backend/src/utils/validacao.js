// Regras de validacao compartilhadas por todos os cadastros do sistema.
//
// Vivem num arquivo so por dois motivos: a regra de senha do aluno e a do
// professor nunca podem divergir, e mudar a regra em um lugar so evita corrigir
// metade do sistema e esquecer a outra metade.
//
// IMPORTANTE: validar no navegador e conforto, validar aqui e seguranca. O HTML
// com type="email" e minlength ajuda o usuario a errar menos, mas qualquer pessoa
// manda uma requisicao direto na API com curl e passa por cima disso. Por isso
// toda regra que importa esta repetida aqui, no servidor.

const TAMANHO_MINIMO_SENHA = 8;
const IDADE_MAXIMA_ANOS = 120;

// Formato de email: alguma coisa, arroba, dominio com ponto, sem espacos.
// Nao prova que o endereco existe - so o envio de um email de confirmacao
// provaria isso. Prova que o texto tem a forma de um email.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// \p{L} casa com qualquer letra de qualquer alfabeto, incluindo acentuadas.
// A flag "u" (unicode) e obrigatoria para \p{L} funcionar.
const CONTEM_LETRA = /\p{L}/u;

// Exige pelo menos uma letra no nome, em vez de proibir digitos.
// Proibir digito recusaria nomes legitimos como "Maria 2a" ou sufixos de
// geracao, e nao e isso que se quer barrar. O que se quer barrar e "123456"
// como nome, e a exigencia de uma letra ja resolve.
function validarNome(nome) {
  if (!nome || nome.trim().length === 0) return 'O nome é obrigatório';
  if (nome.trim().length < 2) return 'O nome precisa ter pelo menos 2 caracteres';
  if (nome.length > 150) return 'O nome pode ter no máximo 150 caracteres';
  if (!CONTEM_LETRA.test(nome)) return 'O nome precisa conter pelo menos uma letra';
  return null;
}

function validarEmail(email) {
  if (!email || email.trim().length === 0) return 'O e-mail é obrigatório';
  if (email.length > 150) return 'O e-mail pode ter no máximo 150 caracteres';
  if (!FORMATO_EMAIL.test(email.trim())) return 'O e-mail informado não e válido';
  return null;
}

function validarSenha(senha) {
  if (!senha) return 'A senha é obrigatória';
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    return `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`;
  }
  if (!/[A-Z]/.test(senha)) return 'A senha precisa ter pelo menos uma letra maiúscula';
  if (!/[a-z]/.test(senha)) return 'A senha precisa ter pelo menos uma letra minúscula';
  if (!/[0-9]/.test(senha)) return 'A senha precisa ter pelo menos um número';
  if (!/[^A-Za-z0-9]/.test(senha)) return 'A senha precisa ter pelo menos um caractere especial';
  return null;
}

function validarConfirmacaoSenha(senha, confirmacao) {
  if (senha !== confirmacao) return 'As senhas não coincidem';
  return null;
}

// A data chega como texto "AAAA-MM-DD", que e o formato do input type="date".
// Recusa data no futuro e data absurdamente antiga: os dois casos sao erro de
// digitacao, nao aluno de verdade.
function validarDataNascimento(data) {
  if (!data) return null; // campo opcional

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return 'Data de nascimento inválida';

  const nascimento = new Date(data + 'T00:00:00');
  if (Number.isNaN(nascimento.getTime())) return 'Data de nascimento inválida';

  const hoje = new Date();
  if (nascimento > hoje) return 'A data de nascimento não pode estar no futuro';

  const maisAntigaAceita = new Date();
  maisAntigaAceita.setFullYear(hoje.getFullYear() - IDADE_MAXIMA_ANOS);
  if (nascimento < maisAntigaAceita) {
    return `A data de nascimento não pode ser anterior a ${IDADE_MAXIMA_ANOS} anos atrás`;
  }
  return null;
}

function validarTelefone(telefone) {
  if (!telefone || telefone.trim().length === 0) return 'O telefone é obrigatório';
  if (telefone.length > 30) return 'O telefone pode ter no máximo 30 caracteres';

  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 8 || digitos.length > 15) {
    return 'O telefone informado não e válido';
  }
  if (!/^[\d\s()+.-]+$/.test(telefone)) return 'O telefone informado não e válido';
  return null;
}

function normalizarCpf(cpf) {
  return (cpf || '').replace(/\D/g, '');
}

function validarCpf(cpf) {
  if (!cpf || cpf.trim().length === 0) return 'O CPF é obrigatório';
  if (!/^[\d.\-\s]+$/.test(cpf)) return 'O CPF informado não e válido';

  const numero = normalizarCpf(cpf);
  if (numero.length !== 11 || /^(\d)\1{10}$/.test(numero)) {
    return 'O CPF informado não e válido';
  }

  let soma = 0;
  for (let i = 0; i < 9; i += 1) soma += Number(numero[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(numero[9])) return 'O CPF informado não e válido';

  soma = 0;
  for (let i = 0; i < 10; i += 1) soma += Number(numero[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(numero[10])) return 'O CPF informado não e válido';

  return null;
}

function validarEspecialidades(especialidades) {
  if (!especialidades || especialidades.trim().length === 0) {
    return 'Informe pelo menos uma especialidade';
  }
  if (especialidades.trim().length > 500) {
    return 'As especialidades podem ter no máximo 500 caracteres';
  }
  return null;
}

// Junta as validacoes de um cadastro e devolve a lista de problemas.
// Lista vazia = tudo certo. Devolver todos os erros de uma vez, em vez de parar
// no primeiro, evita o usuario corrigir um campo, salvar, e descobrir o proximo.
//
// exigirSenha = false na edicao, onde a senha nao e enviada.
function validarCadastro({ nome, email, senha, dataNascimento }, { exigirSenha = true } = {}) {
  const erros = [
    validarNome(nome),
    validarEmail(email),
    exigirSenha ? validarSenha(senha) : null,
    validarDataNascimento(dataNascimento)
  ];
  return erros.filter(Boolean);
}

module.exports = {
  TAMANHO_MINIMO_SENHA,
  validarNome,
  validarEmail,
  validarSenha,
  validarConfirmacaoSenha,
  validarDataNascimento,
  validarCadastro,
  validarTelefone,
  normalizarCpf,
  validarCpf,
  validarEspecialidades
};
