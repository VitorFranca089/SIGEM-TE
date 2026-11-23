// Arquivo JS principal do frontend (sem frameworks, conforme definido no TCC)

// Endereco relativo: a CSP do servidor so deixa a tela chamar o proprio
// endereco dela, e com 'http://localhost:3000' escrito por extenso quem abrisse
// o sistema por 127.0.0.1:3000 ficava sem conseguir falar com a API.
const API_URL = '/api';

document.getElementById('testar-api').addEventListener('click', async () => {
  const resultadoEl = document.getElementById('resultado');
  resultadoEl.textContent = 'Testando...';

  try {
    const response = await fetch(`${API_URL}/health/db`);
    const data = await response.json();

    if (data.status === 'ok') {
      resultadoEl.textContent = `Tudo certo! Horário do banco: ${data.horario_banco}`;
      resultadoEl.style.color = 'green';
    } else {
      resultadoEl.textContent = `Erro: ${data.message}`;
      resultadoEl.style.color = 'red';
    }
  } catch (error) {
    resultadoEl.textContent = 'Não foi possível conectar ao backend. Ele está rodando?';
    resultadoEl.style.color = 'red';
  }
});
