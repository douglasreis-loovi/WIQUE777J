let dados = [];
let dadosFiltrados = [];
let dadosPesquisa = [];
let paginaAtual = 1;
const porPagina = 50;

let tipoModalAtual = ''; // Para saber qual tipo de dados está sendo mostrado

const fileInput = document.getElementById("fileInput");
const modal = document.getElementById("modal");
const modalList = document.getElementById("modalList");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.querySelector(".close");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");
const downloadBtn = document.getElementById("downloadBtn");

// Elementos da pesquisa
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const tableBody = document.getElementById("tableBody");

// Botão salvar
const saveBtn = document.createElement("button");
saveBtn.textContent = "💾 Salvar Dados";
saveBtn.className = "save-btn";
saveBtn.onclick = salvarDados;
document.querySelector(".upload-container").appendChild(saveBtn);

// Função para calcular dias desde a última localização
function calcularDias(ultimaLocalizacao) {
  if (!ultimaLocalizacao || ultimaLocalizacao === '') return 999;
  
  try {
    const dataLimpa = ultimaLocalizacao.trim();
    const partes = dataLimpa.split(' ');
    if (partes.length < 2) return 0;
    
    const dataPartes = partes[0].split('-');
    if (dataPartes.length < 3) return 0;
    
    const ano = parseInt(dataPartes[0]);
    const mes = parseInt(dataPartes[1]) - 1;
    const dia = parseInt(dataPartes[2]);
    
    const dataUltima = new Date(ano, mes, dia);
    dataUltima.setHours(0, 0, 0, 0);
    
    const dataAtual = new Date();
    dataAtual.setHours(0, 0, 0, 0);
    
    const diffMs = dataAtual - dataUltima;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return diffDias;
  } catch (e) {
    console.error("Erro ao calcular dias para:", ultimaLocalizacao, e);
    return 0;
  }
}

// Função para verificar se comunicou hoje
function comunicouHoje(ultimaLocalizacao) {
  if (!ultimaLocalizacao) return false;
  
  try {
    const dataLimpa = ultimaLocalizacao.trim();
    const partes = dataLimpa.split(' ');
    const dataPartes = partes[0].split('-');
    
    if (dataPartes.length < 3) return false;
    
    const ano = parseInt(dataPartes[0]);
    const mes = parseInt(dataPartes[1]) - 1;
    const dia = parseInt(dataPartes[2]);
    
    const dataUltima = new Date(ano, mes, dia);
    dataUltima.setHours(0, 0, 0, 0);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    return dataUltima.getTime() === hoje.getTime();
  } catch (e) {
    console.error("Erro ao verificar comunicação hoje:", e);
    return false;
  }
}

// Função para comprimir dados
function comprimirDados(dadosCompletos) {
  return dadosCompletos.map(d => ({
    i: d.imei,
    c: d.contrato,
    d: d.dias,
    u: d.ultimaLocalizacao,
    h: d.comunicouHoje
  }));
}

// Função para descomprimir dados
function descomprimirDados(dadosComprimidos) {
  return dadosComprimidos.map(d => ({
    imei: d.i,
    contrato: d.c,
    dias: d.d,
    ultimaLocalizacao: d.u,
    comunicouHoje: d.h
  }));
}

// SALVAR DADOS
function salvarDados() {
  if (dados.length > 0) {
    try {
      const dadosComprimidos = comprimirDados(dados);
      const dadosString = JSON.stringify(dadosComprimidos);
      
      const tamanhoMB = (dadosString.length * 2) / (1024 * 1024);
      console.log(`Tamanho dos dados: ${tamanhoMB.toFixed(2)} MB`);
      
      if (tamanhoMB > 4) {
        if (!confirm(`Os dados ocupam ${tamanhoMB.toFixed(2)} MB. Deseja continuar?`)) {
          return;
        }
      }
      
      localStorage.setItem("dadosSalvos", dadosString);
      localStorage.setItem("ultimaAtualizacao", new Date().toLocaleString());
      localStorage.setItem("totalRegistros", dados.length);
      
      alert(`✅ Dados salvos! ${dados.length} registros (${tamanhoMB.toFixed(2)} MB)`);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        alert(`❌ Dados muito grandes. O localStorage tem limite de ~5MB.`);
      } else {
        alert("Erro ao salvar: " + e.message);
      }
    }
  } else {
    alert("⚠️ Nenhum dado para salvar.");
  }
}

// CARREGAR DADOS SALVOS
function carregarSalvos() {
  const salvos = localStorage.getItem("dadosSalvos");
  const ultimaAtualizacao = localStorage.getItem("ultimaAtualizacao");
  const totalRegistros = localStorage.getItem("totalRegistros");
  
  if (salvos) {
    try {
      const dadosComprimidos = JSON.parse(salvos);
      dados = descomprimirDados(dadosComprimidos);
      
      atualizarCards();
      atualizarTabela();
      
      if (ultimaAtualizacao) {
        const oldIndicator = document.querySelector(".cache-indicator");
        if (oldIndicator) oldIndicator.remove();
        
        const indicator = document.createElement("div");
        indicator.className = "cache-indicator";
        indicator.innerHTML = `📁 Dados carregados (${totalRegistros || dados.length} registros - ${ultimaAtualizacao})`;
        document.querySelector(".upload-container").appendChild(indicator);
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    }
  }
}

// PROCESSAR ARQUIVO
fileInput.addEventListener("change", function (e) {
  console.log("Arquivo selecionado!");
  
  const file = e.target.files[0];
  if (!file) {
    console.log("Nenhum arquivo selecionado");
    return;
  }

  console.log("Arquivo:", file.name, "Tamanho:", (file.size / 1024).toFixed(2), "KB");

  const reader = new FileReader();

  reader.onload = function (event) {
    console.log("Arquivo carregado!");
    
    const texto = event.target.result;
    const linhas = texto.split("\n");
    console.log("Total de linhas:", linhas.length);

    const novosDados = [];
    let linhasProcessadas = 0;

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      const colunas = linha.split(",");
      
      if (colunas.length < 3) {
        continue;
      }
      
      const imei = colunas[0]?.trim() || '';
      const contrato = colunas[1]?.trim() || '';
      const ultimaLocalizacao = colunas[2]?.trim() || '';
      
      const dias = calcularDias(ultimaLocalizacao);
      const comunicouHojeFlag = comunicouHoje(ultimaLocalizacao);

      novosDados.push({
        imei: imei,
        contrato: contrato,
        dias: dias,
        ultimaLocalizacao: ultimaLocalizacao,
        comunicouHoje: comunicouHojeFlag
      });
      
      linhasProcessadas++;
      
      if (linhasProcessadas % 1000 === 0) {
        console.log(`Processadas ${linhasProcessadas} linhas...`);
      }
    }

    console.log("Total processado:", novosDados.length);

    if (novosDados.length === 0) {
      alert("❌ Nenhum dado foi processado. Verifique o formato do arquivo.");
      return;
    }

    // Ordena por dias
    novosDados.sort((a, b) => b.dias - a.dias);

    dados = novosDados;
    
    // Tenta salvar automaticamente
    try {
      salvarDados();
    } catch (e) {
      console.warn("Não foi possível salvar automaticamente:", e);
    }

    atualizarCards();
    atualizarTabela();
    
    alert(`✅ Sucesso! Processados ${dados.length} registros`);
  };

  reader.onerror = function(error) {
    console.error("Erro ao ler arquivo:", error);
    alert("❌ Erro ao ler o arquivo. Tente novamente.");
  };

  reader.readAsText(file);
});

// ATUALIZAR CARDS
function atualizarCards() {
  const countComunicouHoje = dados.filter(d => d.comunicouHoje === true).length;
  const countSemComunicacaoHoje = dados.filter(d => d.dias > 0).length;
  const count7 = dados.filter(d => d.dias > 7).length;
  const count15 = dados.filter(d => d.dias > 15).length;
  const count30 = dados.filter(d => d.dias > 30).length;
  
  document.getElementById("countComunicouHoje").innerText = countComunicouHoje;
  document.getElementById("countSemComunicacaoHoje").innerText = countSemComunicacaoHoje;
  document.getElementById("count7").innerText = count7;
  document.getElementById("count15").innerText = count15;
  document.getElementById("count30").innerText = count30;
  
  console.log(`Cards atualizados: 
    Comunicou hoje:${countComunicouHoje} 
    Sem comunicação hoje:${countSemComunicacaoHoje} 
    >7:${count7} 
    >15:${count15} 
    >30:${count30}`);
}

// ATUALIZAR TABELA
function atualizarTabela(dadosParaMostrar = dados) {
  tableBody.innerHTML = "";
  
  if (dadosParaMostrar.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" style="text-align: center; padding: 30px;">
      📁 Nenhum dado encontrado. Carregue uma planilha CSV.
    </td>`;
    tableBody.appendChild(row);
    return;
  }
  
  const mostrarAte = Math.min(100, dadosParaMostrar.length);
  
  for (let i = 0; i < mostrarAte; i++) {
    const d = dadosParaMostrar[i];
    const row = document.createElement("tr");
    
    let bgColor = '';
    if (d.dias > 30) bgColor = 'style="background-color: #7f1d1d;"';
    else if (d.dias > 15) bgColor = 'style="background-color: #854d0e;"';
    else if (d.dias > 7) bgColor = 'style="background-color: #1e3a8a;"';
    else if (d.dias > 0) bgColor = 'style="background-color: #b45309;"';
    else if (d.dias === 0) bgColor = 'style="background-color: #065f46;"';
    
    row.innerHTML = `
      <td ${bgColor}>${(d.imei || '-').substring(0, 30)}${d.imei && d.imei.length > 30 ? '...' : ''}</td>
      <td ${bgColor}>${(d.contrato || '-').substring(0, 20)}${d.contrato && d.contrato.length > 20 ? '...' : ''}</td>
      <td ${bgColor}><strong>${d.dias || 0} dias</strong></td>
      <td ${bgColor}>${d.ultimaLocalizacao || '-'}</td>
    `;
    tableBody.appendChild(row);
  }
  
  if (dadosParaMostrar.length > 100) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" style="text-align: center; padding: 10px; background: #4c1d95;">
      Mostrando 100 de ${dadosParaMostrar.length} registros. Use a pesquisa para encontrar específicos.
    </td>`;
    tableBody.appendChild(row);
  }
}

// PESQUISAR IMEI
function pesquisarIMEI() {
  const termo = searchInput.value.trim().toLowerCase();
  
  if (termo === "") {
    dadosPesquisa = dados;
  } else {
    dadosPesquisa = dados.filter(d => 
      d.imei && d.imei.toLowerCase().includes(termo)
    );
  }
  
  atualizarTabela(dadosPesquisa);
  
  if (dadosPesquisa.length === 0) {
    alert(`🔍 Nenhum IMEI encontrado com: "${termo}"`);
  } else {
    alert(`🔍 Encontrados ${dadosPesquisa.length} registros`);
  }
}

// LIMPAR PESQUISA
function limparPesquisa() {
  searchInput.value = "";
  dadosPesquisa = dados;
  atualizarTabela(dados);
}

// FUNÇÃO PARA BAIXAR PLANILHA
function baixarPlanilha() {
  if (dadosFiltrados.length === 0) {
    alert("❌ Nenhum dado para baixar.");
    return;
  }
  
  // Criar cabeçalho do CSV
  let csv = "imei,contrato,dias_sem_comunicacao,ultima_localizacao\n";
  
  // Adicionar dados
  dadosFiltrados.forEach(d => {
    const linha = `"${d.imei}","${d.contrato}",${d.dias},"${d.ultimaLocalizacao}"`;
    csv += linha + "\n";
  });
  
  // Criar nome do arquivo baseado no tipo
  let nomeArquivo = "dados";
  if (tipoModalAtual === 'comunicouHoje') nomeArquivo = "comunicacoes_hoje";
  else if (tipoModalAtual === 'semComunicacaoHoje') nomeArquivo = "sem_comunicacao_hoje";
  else if (tipoModalAtual === 7) nomeArquivo = "mais_7_dias";
  else if (tipoModalAtual === 15) nomeArquivo = "mais_15_dias";
  else if (tipoModalAtual === 30) nomeArquivo = "mais_30_dias";
  
  // Adicionar data
  const data = new Date().toISOString().split('T')[0];
  nomeArquivo = `${nomeArquivo}_${data}.csv`;
  
  // Criar blob e download
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // \uFEFF para UTF-8 com BOM
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = nomeArquivo;
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  alert(`✅ Planilha baixada: ${nomeArquivo} (${dadosFiltrados.length} registros)`);
}

// ABRIR MODAL
function abrirModal(tipo) {
  tipoModalAtual = tipo;
  
  if (tipo === 'comunicouHoje') {
    dadosFiltrados = dados.filter(d => d.comunicouHoje === true);
    modalTitle.innerText = `✅ Dispositivos que comunicaram hoje (${dadosFiltrados.length})`;
  } else if (tipo === 'semComunicacaoHoje') {
    dadosFiltrados = dados.filter(d => d.dias > 0);
    modalTitle.innerText = `📅 Dispositivos sem comunicação hoje (${dadosFiltrados.length})`;
  } else if (tipo === 7) {
    dadosFiltrados = dados.filter(d => d.dias > 7);
    modalTitle.innerText = `⚠️ Dispositivos > 7 dias (${dadosFiltrados.length})`;
  } else if (tipo === 15) {
    dadosFiltrados = dados.filter(d => d.dias > 15);
    modalTitle.innerText = `🔴 Dispositivos > 15 dias (${dadosFiltrados.length})`;
  } else if (tipo === 30) {
    dadosFiltrados = dados.filter(d => d.dias > 30);
    modalTitle.innerText = `⛔ Dispositivos > 30 dias (${dadosFiltrados.length})`;
  }

  dadosFiltrados.sort((a, b) => b.dias - a.dias);

  paginaAtual = 1;
  renderizarPagina();
  modal.style.display = "block";
}

// RENDERIZAR PÁGINA DO MODAL
function renderizarPagina() {
  modalList.innerHTML = "";

  const inicio = (paginaAtual - 1) * porPagina;
  const fim = inicio + porPagina;
  const pagina = dadosFiltrados.slice(inicio, fim);

  pagina.forEach(d => {
    const item = document.createElement("div");
    
    let corDestaque = '';
    let icone = '⏱️';
    
    if (d.dias > 30) {
      corDestaque = 'color: #fca5a5; font-weight: bold;';
      icone = '⛔';
    } else if (d.dias > 15) {
      corDestaque = 'color: #fcd34d; font-weight: bold;';
      icone = '🔴';
    } else if (d.dias > 7) {
      corDestaque = 'color: #93c5fd; font-weight: bold;';
      icone = '⚠️';
    } else if (d.dias > 0) {
      corDestaque = 'color: #fbbf24; font-weight: bold;';
      icone = '📅';
    } else if (d.dias === 0) {
      corDestaque = 'color: #6ee7b7; font-weight: bold;';
      icone = '✅';
    }
    
    item.innerHTML = `
      <div style="background: #2e1065; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
        <p><strong>IMEI:</strong> ${d.imei}</p>
        <p><strong>Contrato:</strong> ${d.contrato}</p>
        <p><strong style="${corDestaque}">${icone} Dias sem comunicação: ${d.dias}</strong></p>
        <p><strong>📅 Última Localização:</strong> ${d.ultimaLocalizacao}</p>
      </div>
    `;
    modalList.appendChild(item);
  });

  const totalPaginas = Math.ceil(dadosFiltrados.length / porPagina);
  pageInfo.innerText = `Página ${paginaAtual} de ${totalPaginas || 1}`;
}

// EVENT LISTENERS
prevBtn.onclick = function () {
  if (paginaAtual > 1) {
    paginaAtual--;
    renderizarPagina();
  }
};

nextBtn.onclick = function () {
  const totalPaginas = Math.ceil(dadosFiltrados.length / porPagina);
  if (paginaAtual < totalPaginas) {
    paginaAtual++;
    renderizarPagina();
  }
};

closeModal.onclick = function () {
  modal.style.display = "none";
};

// Botão de download
downloadBtn.onclick = baixarPlanilha;

// Eventos dos cards
document.getElementById("cardComunicouHoje").onclick = () => abrirModal('comunicouHoje');
document.getElementById("cardSemComunicacaoHoje").onclick = () => abrirModal('semComunicacaoHoje');
document.getElementById("card7").onclick = () => abrirModal(7);
document.getElementById("card15").onclick = () => abrirModal(15);
document.getElementById("card30").onclick = () => abrirModal(30);

// Eventos de pesquisa
searchBtn.onclick = pesquisarIMEI;
clearSearchBtn.onclick = limparPesquisa;

searchInput.addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    pesquisarIMEI();
  }
});

window.onclick = function(event) {
  if (event.target === modal) {
    modal.style.display = "none";
  }
};

// Botão limpar cache
const clearCacheBtn = document.createElement("button");
clearCacheBtn.textContent = "🗑️ Limpar Cache";
clearCacheBtn.className = "clear-cache-btn";
clearCacheBtn.onclick = function() {
  if (confirm("Tem certeza que deseja limpar todos os dados salvos?")) {
    localStorage.removeItem("dadosSalvos");
    localStorage.removeItem("ultimaAtualizacao");
    localStorage.removeItem("totalRegistros");
    dados = [];
    atualizarCards();
    atualizarTabela();
    alert("Cache limpo!");
    
    const indicator = document.querySelector(".cache-indicator");
    if (indicator) indicator.remove();
  }
};
document.querySelector(".upload-container").appendChild(clearCacheBtn);

// INICIAR
console.log("Sistema iniciado!");
carregarSalvos();