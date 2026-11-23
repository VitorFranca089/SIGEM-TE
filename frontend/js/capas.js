// Capas demonstrativas selecionadas exclusivamente no Pexels.
// A URL da turma, quando preenchida pelo administrador ou professor, sempre
// tem prioridade sobre estas sugestões.
const CAPAS_PEXELS = {
  partitura: 'https://images.pexels.com/photos/7095050/pexels-photo-7095050.jpeg?auto=compress&cs=tinysrgb&w=1200',
  violino: 'https://images.pexels.com/photos/17249491/pexels-photo-17249491.jpeg?auto=compress&cs=tinysrgb&w=1200',
  violao: 'https://images.pexels.com/photos/1205062/pexels-photo-1205062.jpeg?auto=compress&cs=tinysrgb&w=1200',
  canto: 'https://images.pexels.com/photos/2531728/pexels-photo-2531728.jpeg?auto=compress&cs=tinysrgb&w=1200',
  guitarra: 'https://images.pexels.com/photos/11367120/pexels-photo-11367120.jpeg?auto=compress&cs=tinysrgb&w=1200',
  hiphop: 'https://images.pexels.com/photos/16736179/pexels-photo-16736179.jpeg?auto=compress&cs=tinysrgb&w=1200',
  piano: 'https://images.pexels.com/photos/6670810/pexels-photo-6670810.jpeg?auto=compress&cs=tinysrgb&w=1200',
  bateria: 'https://images.pexels.com/photos/5809298/pexels-photo-5809298.jpeg?auto=compress&cs=tinysrgb&w=1200',
  teclado: 'https://images.pexels.com/photos/14435275/pexels-photo-14435275.jpeg?auto=compress&cs=tinysrgb&w=1200'
};

function aplicarCapa(elemento, url, chave) {
  const imagem = url || CAPAS_PEXELS[chave];
  if (!imagem) return;
  elemento.classList.add('com-capa');
  elemento.style.backgroundImage = `linear-gradient(180deg, rgba(0, 0, 0, 0.04) 30%, rgba(0, 0, 0, 0.78) 100%), url("${imagem}")`;
}

document.querySelectorAll('[data-capa]').forEach((elemento) => {
  aplicarCapa(elemento, '', elemento.dataset.capa);
});

window.CAPAS_PEXELS = CAPAS_PEXELS;
window.aplicarCapa = aplicarCapa;
