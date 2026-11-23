// Comportamentos comuns dos campos de senha: Caps Lock e requisitos visuais.
(function () {
  document.querySelectorAll('input[type="password"]').forEach((campo) => {
    const aviso = document.createElement('small');
    aviso.className = 'aviso-capslock';
    aviso.textContent = 'Caps Lock está ativado. A senha diferencia maiúsculas de minúsculas.';
    aviso.hidden = true;
    // O aviso precisa ficar abaixo do conjunto input + botao. Inserir depois
    // do input deixava o texto como um terceiro item da mesma linha flex.
    const areaSenha = campo.closest('.campo-com-botao');
    (areaSenha || campo).insertAdjacentElement('afterend', aviso);

    function verificarCapsLock(evento) {
      // InputEvent nem sempre oferece getModifierState; nesse caso mantemos
      // o último estado informado pelo keydown/keyup, em vez de esconder o
      // aviso indevidamente enquanto a pessoa digita.
      if (typeof evento.getModifierState !== 'function') return;
      const ativo = evento.getModifierState('CapsLock') === true;
      aviso.hidden = !ativo;
    }

    campo.addEventListener('keydown', verificarCapsLock);
    campo.addEventListener('keyup', verificarCapsLock);
    campo.addEventListener('input', verificarCapsLock);
    campo.addEventListener('blur', () => { aviso.hidden = true; });
  });
})();
