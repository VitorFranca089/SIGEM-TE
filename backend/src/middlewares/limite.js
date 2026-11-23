// Limitador simples em memoria para endpoints sensiveis. Ele nao substitui um
// gateway em producao, mas impede rajadas basicas de tentativa no servidor MVP.
const janelas = new Map();

function limitarTentativas({ nome, janelaMs, maximo, chave = (req) => req.ip, contarSoFalhas = false }) {
  return function (req, res, next) {
    const agora = Date.now();
    const identificador = `${nome}:${chave(req)}`;
    const anterior = janelas.get(identificador);
    const registro = anterior && agora - anterior.inicio < janelaMs
      ? anterior
      : { inicio: agora, quantidade: 0 };

    janelas.set(identificador, registro);

    // Evita que enderecos antigos ocupem memoria indefinidamente em um
    // processo que permanece ligado por muitos dias.
    if (janelas.size > 10000) {
      for (const [chaveAtual, janelaAtual] of janelas) {
        if (agora - janelaAtual.inicio >= janelaMs) janelas.delete(chaveAtual);
      }
    }

    if (registro.quantidade >= maximo) {
      const espera = Math.ceil((janelaMs - (agora - registro.inicio)) / 1000);
      res.set('Retry-After', String(espera));
      return res.status(429).json({
        status: 'erro',
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      });
    }

    if (contarSoFalhas) {
      // No login, so a tentativa errada gasta a cota. Contando tambem as
      // certas, cinco trocas de usuario em 15 minutos (admin, professor,
      // aluno... numa demonstracao) bloqueavam o computador inteiro, porque a
      // chave e o IP. O resultado so se sabe depois do controller responder.
      res.on('finish', () => {
        if (res.statusCode >= 400) registro.quantidade += 1;
      });
    } else {
      registro.quantidade += 1;
    }
    next();
  };
}

module.exports = { limitarTentativas };
