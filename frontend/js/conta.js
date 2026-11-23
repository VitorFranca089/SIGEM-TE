const contaNome = document.getElementById('conta-nome');
const contaDetalhes = document.getElementById('conta-detalhes');
const contaAcao = document.getElementById('conta-acao');
const contaUsuario = Sessao.usuario();

if (contaUsuario) {
  const perfis = { aluno: 'Aluno', professor: 'Docente', admin: 'Administrador' };
  contaNome.textContent = contaUsuario.nome;
  contaDetalhes.textContent = `${contaUsuario.email} · ${perfis[contaUsuario.perfil] || contaUsuario.perfil}`;
  contaAcao.textContent = 'Sair';
  contaAcao.href = '#';
  contaAcao.addEventListener('click', (evento) => {
    evento.preventDefault();
    Sessao.encerrar();
    window.location.href = 'index.html';
  });
}
