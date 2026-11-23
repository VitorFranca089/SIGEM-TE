// Preenche um banco VAZIO com uma escola de demonstracao, para a banca.
//
// Por que este script existe: apresentar com o banco vazio, cadastrando tudo
// ao vivo, gasta os 20 minutos da banca e convida o erro. E a chamada (RF05)
// nem pode ser mostrada assim: a API recusa aula no passado, e a chamada so
// abre depois que a aula comeca. Aqui a aula do dia ja nasce comecada.
//
// E a mesma escola das capturas de tela do TCC (Helena, Marcos, Beatriz...),
// para a banca ver ao vivo o que viu nas figuras. Os dados contam uma
// historia, em vez de encher tabela: o Carlos tem duas faltas, a Beatriz
// mandou uma pratica e a resposta da professora ainda nao foi lida, a
// partitura foi para a turma e dois alunos ja a abriram, e a professora pediu
// uma turma nova que espera o administrador.
//
// Por que INSERT direto, e nao pela API: a API recusa de proposito o que a
// historia precisa (aulas passadas com chamada feita). Este script roda no
// terminal de quem ja tem acesso ao banco, como o criar-admin.
//
// Como rodar, a partir de backend/ (o banco sigem_banca fica separado do
// sigem_db, e apagar ele nao perde nada de verdade):
//   createdb -h localhost -U postgres sigem_banca
//   psql -h localhost -U postgres -d sigem_banca -f src/config/schema.sql
//   DB_NAME=sigem_banca npm run dados-demo
//   DB_NAME=sigem_banca npm run dev
//
// Rode no dia da apresentacao, pelo menos 15 minutos antes: a aula de hoje
// comeca 10 minutos antes da hora em que o script roda.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

// A mesma pasta do middlewares/upload.js: o download procura o arquivo la.
const PASTA_UPLOADS = path.join(__dirname, '../../uploads');

// Uma senha so para todos: na banca, ninguem quer procurar senha em papel.
// Passa na validarSenha() (maiuscula, minuscula, numero e especial).
const SENHA_DEMO = 'Banca@2026';
const CUSTO_HASH = 10;

// O mesmo dominio das capturas do TCC. Nenhum e-mail sai para estes
// enderecos: o SMTP so manda o codigo de recuperacao, e so se for pedido.
const PESSOAS = {
  admin: { nome: 'Administração SIGEM', email: 'admin@sigem.demo', perfil: 'admin' },
  helena: { nome: 'Helena Duarte', email: 'helena@sigem.demo', perfil: 'professor',
    telefone: '(14) 99812-3344', nascimento: '1985-03-12', base: '529982247',
    especialidades: 'Violão, Teoria musical' },
  marcos: { nome: 'Marcos Teixeira', email: 'marcos@sigem.demo', perfil: 'professor',
    telefone: '(14) 99745-1020', nascimento: '1979-09-30', base: '111444777',
    especialidades: 'Piano, Teclado' },
  beatriz: { nome: 'Beatriz Lima', email: 'beatriz@sigem.demo', perfil: 'aluno', nascimento: '2008-05-02' },
  carlos: { nome: 'Carlos Souza', email: 'carlos@sigem.demo', perfil: 'aluno', nascimento: '2007-09-19' },
  daniela: { nome: 'Daniela Rocha', email: 'daniela@sigem.demo', perfil: 'aluno', nascimento: '2009-01-30' },
  eduardo: { nome: 'Eduardo Alves', email: 'eduardo@sigem.demo', perfil: 'aluno', nascimento: '2006-11-08' },
  fernanda: { nome: 'Fernanda Costa', email: 'fernanda@sigem.demo', perfil: 'aluno', nascimento: '2010-07-14' }
};

// O cadastro de professor recusa CPF com digito verificador errado
// (utils/validacao.js). Um CPF inventado precisa passar na mesma conta, senao
// a tela de edicao recusaria salvar o professor da demonstracao.
function cpfValido(base9) {
  const digitos = base9.split('').map(Number);
  for (const tamanho of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += digitos[i] * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    digitos.push(resto === 10 ? 0 : resto);
  }
  return digitos.join('');
}

// Um WAV curto (um arpejo de do maior), gerado aqui para o script nao
// depender de arquivo de audio guardado no repositorio.
function gerarWav(notasHz, segundosPorNota) {
  const taxa = 22050;
  const amostrasPorNota = Math.floor(taxa * segundosPorNota);
  const total = amostrasPorNota * notasHz.length;
  const buf = Buffer.alloc(44 + total * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + total * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(taxa, 24); buf.writeUInt32LE(taxa * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(total * 2, 40);
  notasHz.forEach((hz, n) => {
    for (let i = 0; i < amostrasPorNota; i++) {
      // o volume cai ao longo da nota, como uma corda tocada
      const envelope = Math.exp(-3 * i / amostrasPorNota);
      const valor = Math.sin(2 * Math.PI * hz * i / taxa) * envelope * 0.5;
      buf.writeInt16LE(Math.round(valor * 32767), 44 + (n * amostrasPorNota + i) * 2);
    }
  });
  return buf;
}

// Um PDF de uma pagina, montado a mao. As fontes padrao do PDF entendem
// acento pela tabela WinAnsi, que e o latin1; o caractere vai como \ooo.
function gerarPdf(linhas) {
  const escapar = (texto) => Array.from(Buffer.from(texto, 'latin1'))
    .map((b) => (b < 128 ? String.fromCharCode(b).replace(/[\\()]/g, '\\$&') : '\\' + b.toString(8)))
    .join('');
  const conteudo = 'BT /F1 14 Tf 72 760 Td 20 TL ' +
    linhas.map((l) => `(${escapar(l)}) Tj T*`).join(' ') + ' ET';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  ];
  let pdf = '%PDF-1.4\n';
  const posicoes = objetos.map((obj, i) => {
    const pos = pdf.length;
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return pos;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    posicoes.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function main() {
  const banco = process.env.DB_NAME;
  const db = await pool.connect();
  const gravados = [];
  try {
    // A trava: so roda em banco sem escola. Assim o script nunca mistura
    // gente inventada com os dados de verdade de uma instalacao em uso.
    const ocupado = await db.query(`
      SELECT (SELECT COUNT(*) FROM curso) + (SELECT COUNT(*) FROM aluno)
           + (SELECT COUNT(*) FROM professor) AS total
    `);
    if (Number(ocupado.rows[0].total) > 0) {
      console.error(`\nO banco "${banco}" ja tem cursos, alunos ou professores.`);
      console.error('Este script so preenche banco vazio. Use um banco novo, como o sigem_banca.');
      return 1;
    }

    // A aula de hoje comeca 10 minutos atras e dura 70; perto da meia-noite
    // ela atravessaria o dia, e a tabela aula recusa hora_inicio >= hora_fim.
    const agora = await db.query(`SELECT EXTRACT(HOUR FROM LOCALTIME)::int AS hora`);
    if (agora.rows[0].hora < 1 || agora.rows[0].hora >= 22) {
      console.error('\nRode entre 01h e 22h: a aula de hoje nao pode atravessar a meia-noite.');
      return 1;
    }

    await db.query('BEGIN');
    const hash = await bcrypt.hash(SENHA_DEMO, CUSTO_HASH);

    // usuario primeiro; professor e aluno sao satelites dele
    const u = {}; const prof = {}; const al = {};
    for (const [chave, p] of Object.entries(PESSOAS)) {
      const r = await db.query(
        'INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES ($1, $2, $3, $4) RETURNING id',
        [p.nome, p.email, hash, p.perfil]);
      u[chave] = r.rows[0].id;
      if (p.perfil === 'professor') {
        const rp = await db.query(`
          INSERT INTO professor (usuario_id, telefone, data_nascimento, cpf, especialidades)
          VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [u[chave], p.telefone, p.nascimento, cpfValido(p.base), p.especialidades]);
        prof[chave] = rp.rows[0].id;
      } else if (p.perfil === 'aluno') {
        const ra = await db.query(
          'INSERT INTO aluno (usuario_id, data_nascimento) VALUES ($1, $2) RETURNING id',
          [u[chave], p.nascimento]);
        al[chave] = ra.rows[0].id;
      }
    }

    const curso = async (nome, descricao) => (await db.query(
      'INSERT INTO curso (nome, descricao) VALUES ($1, $2) RETURNING id', [nome, descricao])).rows[0].id;
    const violao = await curso('Violão', 'Do primeiro acorde ao repertório popular.');
    const piano = await curso('Piano', 'Técnica, leitura de partitura e repertório.');
    await curso('Teoria Musical', 'Leitura, ritmo e harmonia básica.');

    // A turma de violao cai no dia da semana de hoje, no horario da aula de
    // hoje: assim a Agenda e a Chamada contam a mesma historia.
    const horario = (await db.query(`
      SELECT EXTRACT(DOW FROM CURRENT_DATE)::int AS dia,
             TO_CHAR(date_trunc('minute', LOCALTIME - INTERVAL '10 minutes'), 'HH24:MI') AS inicio,
             TO_CHAR(date_trunc('minute', LOCALTIME + INTERVAL '60 minutes'), 'HH24:MI') AS fim
    `)).rows[0];
    const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const nomeViolao = `Violão Iniciante - ${DIAS[horario.dia]}`;
    // o piano fica na sexta, como nas capturas; se hoje for sexta, vai para o sabado
    const diaPiano = horario.dia === 5 ? 6 : 5;
    const nomePiano = `Piano Intermediário - ${DIAS[diaPiano]}`;
    const diasAtePiano = (diaPiano - horario.dia + 7) % 7;

    const turma = async (cursoId, profId, nome, dia, inicio, fim, status = 'ativa', solicitante = null) => (await db.query(`
      INSERT INTO turma (curso_id, professor_id, solicitante_id, nome, dia_semana, hora_inicio, hora_fim, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [cursoId, profId, solicitante, nome, dia, inicio, fim, status])).rows[0].id;
    const tViolao = await turma(violao, prof.helena, nomeViolao, horario.dia, horario.inicio, horario.fim);
    const tPiano = await turma(piano, prof.marcos, nomePiano, diaPiano, '18:00', '19:00');
    // pedida pela professora: aparece para o administrador aprovar ou recusar
    await turma(violao, prof.helena, 'Violão Intermediário - Sábado', 6, '10:00', '11:00', 'solicitada', prof.helena);

    // A Beatriz esta nas duas turmas: entrando com ela, a banca ve de tudo.
    for (const a of ['beatriz', 'carlos', 'daniela']) {
      await db.query('INSERT INTO matricula (turma_id, aluno_id) VALUES ($1, $2)', [tViolao, al[a]]);
    }
    for (const a of ['beatriz', 'eduardo', 'fernanda']) {
      await db.query('INSERT INTO matricula (turma_id, aluno_id) VALUES ($1, $2)', [tPiano, al[a]]);
    }

    const grupo = (await db.query(`
      INSERT INTO grupo (nome, descricao, professor_id, criado_por)
      VALUES ('Coral da Escola', 'Ensaios abertos para alunos de todos os cursos.', $1, $2) RETURNING id`,
      [prof.helena, u.admin])).rows[0].id;
    for (const a of ['beatriz', 'fernanda']) {
      await db.query('INSERT INTO grupo_membro (grupo_id, aluno_id) VALUES ($1, $2)', [grupo, al[a]]);
    }

    // dias = deslocamento a partir de hoje (negativo = passado)
    const aula = async ({ turmaId = null, grupoId = null, dias, inicio, fim, resp, status = 'agendada', obs = null }) => (await db.query(`
      INSERT INTO aula (turma_id, grupo_id, data, hora_inicio, hora_fim, responsavel_id, criado_por, status, observacoes)
      VALUES ($1, $2, CURRENT_DATE + $3::int, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [turmaId, grupoId, dias, inicio, fim, resp, u.admin, status, obs])).rows[0].id;

    // Tres aulas passadas com chamada feita. O Carlos faltou nas duas ultimas:
    // e o que ele ve em Classes, e o que a professora ve na Chamada.
    const faltas = { '-21': [], '-14': ['carlos'], '-7': ['carlos'] };
    for (const dias of [-21, -14, -7]) {
      const id = await aula({ turmaId: tViolao, dias, inicio: horario.inicio, fim: horario.fim,
        resp: prof.helena, status: 'realizada' });
      for (const a of ['beatriz', 'carlos', 'daniela']) {
        await db.query('INSERT INTO frequencia (aula_id, aluno_id, presente) VALUES ($1, $2, $3)',
          [id, al[a], !faltas[String(dias)].includes(a)]);
      }
    }
    // A aula de hoje, ja comecada e sem chamada: e a que se faz ao vivo.
    await aula({ turmaId: tViolao, dias: 0, inicio: horario.inicio, fim: horario.fim, resp: prof.helena });
    await aula({ turmaId: tViolao, dias: 7, inicio: horario.inicio, fim: horario.fim, resp: prof.helena });
    const cancelada = await aula({ turmaId: tViolao, dias: 14, inicio: horario.inicio, fim: horario.fim, resp: prof.helena });
    await db.query(`
      UPDATE aula SET status = 'cancelada', cancelada_em = NOW() - INTERVAL '1 day',
             cancelada_por = $2, motivo_cancelamento = 'Feriado municipal.'
      WHERE id = $1`, [cancelada, u.helena]);

    // piano: duas aulas passadas, todos presentes, e a proxima remarcada
    for (const dias of [diasAtePiano - 14, diasAtePiano - 7]) {
      const id = await aula({ turmaId: tPiano, dias, inicio: '18:00', fim: '19:00', resp: prof.marcos, status: 'realizada' });
      for (const a of ['beatriz', 'eduardo', 'fernanda']) {
        await db.query('INSERT INTO frequencia (aula_id, aluno_id, presente) VALUES ($1, $2, true)', [id, al[a]]);
      }
    }
    await aula({ turmaId: tPiano, dias: diasAtePiano || 7, inicio: '19:00', fim: '20:00', resp: prof.marcos,
      obs: 'Remarcada das 18h para as 19h, a pedido da turma.' });
    await aula({ grupoId: grupo, dias: 3, inicio: '10:00', fim: '11:30', resp: prof.helena,
      obs: 'Ensaio para a apresentação de fim de ano.' });

    // Os arquivos vao para o disco com nome aleatorio e sem extensao, como o
    // multer faz no envio de verdade; o banco guarda so o nome no disco. Num
    // clone novo a pasta ainda nao existe: quem a cria e o upload.js, que so
    // carrega com o servidor.
    fs.mkdirSync(PASTA_UPLOADS, { recursive: true });
    const guardar = (conteudo) => {
      const nome = crypto.randomBytes(16).toString('hex');
      fs.writeFileSync(path.join(PASTA_UPLOADS, nome), conteudo);
      gravados.push(nome);
      return nome;
    };
    const arquivo = async ({ de, turmaId = null, alunoId = null, tipo, conteudo, nome, diasAtras }) => (await db.query(`
      INSERT INTO arquivo (usuario_id, turma_id, aluno_id, tipo, caminho, nome_original, enviado_em)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() - make_interval(days => $7)) RETURNING id`,
      [de, turmaId, alunoId, tipo, guardar(conteudo), nome, diasAtras])).rows[0].id;
    const notificar = (para, mensagem, arquivoId, lida, diasAtras) => db.query(`
      INSERT INTO notificacao (usuario_id, mensagem, arquivo_id, lida, criada_em)
      VALUES ($1, $2, $3, $4, NOW() - make_interval(days => $5))`, [para, mensagem, arquivoId, lida, diasAtras]);
    const baixou = async (arquivoId, chave, nome, diasAtras, lida) => {
      await db.query(`INSERT INTO arquivo_download (arquivo_id, usuario_id, baixado_em)
        VALUES ($1, $2, NOW() - make_interval(days => $3))`, [arquivoId, u[chave], diasAtras]);
      await notificar(u.helena, `${PESSOAS[chave].nome} acessou o material "${nome}".`, arquivoId, lida, diasAtras);
    };

    // As mensagens seguem palavra por palavra as do arquivo.controller.js,
    // para nao se distinguirem das que o sistema gera ao vivo.
    const partitura = 'Partitura - Asa Branca.pdf';
    const pdf = await arquivo({ de: u.helena, turmaId: tViolao, tipo: 'application/pdf', diasAtras: 6, nome: partitura,
      conteudo: gerarPdf(['Asa Branca (Luiz Gonzaga e Humberto Teixeira)', 'Violão Iniciante - acordes da música', '',
        'Introdução: G  C  G  D  G', 'Estrofe: G  C  G  D7  G', '',
        'Praticar a troca G -> C -> D7, dez minutos por dia,', 'e gravar a prática no SIGEM até a próxima aula.']) });
    for (const a of ['beatriz', 'carlos', 'daniela']) {
      await notificar(u[a], `Helena Duarte enviou o material "${partitura}" para a turma ${nomeViolao}.`, pdf, a !== 'daniela', 6);
    }
    await baixou(pdf, 'beatriz', partitura, 5, true);
    await baixou(pdf, 'carlos', partitura, 4, true);

    const escalas = 'Estudo de escalas.pdf';
    const pdfPiano = await arquivo({ de: u.marcos, turmaId: tPiano, tipo: 'application/pdf', diasAtras: 4, nome: escalas,
      conteudo: gerarPdf(['Estudo de escalas', '', 'Dó maior, Sol maior e Ré maior, duas oitavas.', 'Mãos separadas, depois juntas.']) });
    for (const a of ['beatriz', 'eduardo', 'fernanda']) {
      await notificar(u[a], `Marcos Teixeira enviou o material "${escalas}" para a turma ${nomePiano}.`, pdfPiano, false, 4);
    }

    // Sol maior: sol, si, re, sol
    const nomePratica = 'Asa Branca - minha pratica.wav';
    const pratica = await arquivo({ de: u.beatriz, alunoId: al.beatriz, tipo: 'audio/wav', diasAtras: 3,
      nome: nomePratica, conteudo: gerarWav([392.0, 493.88, 587.33, 783.99], 0.8) });
    // os professores das turmas da aluna; a Helena ja ouviu, o Marcos nao
    await notificar(u.helena, `Beatriz Lima enviou a gravação de prática "${nomePratica}".`, pratica, true, 3);
    await notificar(u.marcos, `Beatriz Lima enviou a gravação de prática "${nomePratica}".`, pratica, false, 3);

    // A resposta da professora so para a Beatriz, ainda nao lida: na
    // demonstracao, o numero vermelho de Notificacoes ja aparece para ela.
    const nomeRetorno = 'Retorno - Asa Branca.wav';
    const retorno = await arquivo({ de: u.helena, alunoId: al.beatriz, tipo: 'audio/wav', diasAtras: 2,
      nome: nomeRetorno, conteudo: gerarWav([392.0, 523.25, 587.33, 392.0], 0.6) });
    await notificar(u.beatriz, `Helena Duarte enviou o material "${nomeRetorno}" para você.`, retorno, false, 2);

    await db.query('COMMIT');

    console.log(`\nEscola de demonstração criada no banco "${banco}". Senha de todos: ${SENHA_DEMO}\n`);
    for (const p of Object.values(PESSOAS)) {
      console.log(`  ${p.perfil.padEnd(9)} ${p.email.padEnd(24)} ${p.nome}`);
    }
    console.log(`\nAula de hoje (${nomeViolao}): ${horario.inicio} às ${horario.fim}, já aberta para a chamada.`);
    return 0;
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    // sem a linha no banco, o arquivo no disco viraria lixo que ninguem acha
    for (const nome of gravados) fs.rmSync(path.join(PASTA_UPLOADS, nome), { force: true });
    console.error('\nFalha ao criar os dados de demonstração:', e.message);
    return 1;
  } finally {
    db.release();
    await pool.end();
  }
}

main().then((codigo) => process.exit(codigo));
