
const API_BASE = "http://127.0.0.1:8001";

const $ = (id) => document.getElementById(id);

function showJSON(elementId, data) {
  $(elementId).textContent = JSON.stringify(data, null, 2);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({
    detail: "The server returned an unreadable response."
  }));

  if (!response.ok) {
    throw new Error(data.detail || `HTTP error ${response.status}`);
  }

  return data;
}

function showError(elementId, error) {
  $(elementId).textContent = `Error: ${error.message}`;
}

// 1. Check whether FastAPI is responding
async function checkHealth() {
  try {
    const data = await apiRequest("/health");

    $("apiStatus").textContent = "API Connected";
    $("apiStatus").classList.remove("error");
    $("healthValue").textContent = "Online";
  } catch (error) {
    $("apiStatus").textContent = "API Offline";
    $("apiStatus").classList.add("error");
    $("healthValue").textContent = "Offline";
  }
}

// 2. Load pipeline status and output files
async function refreshStatus() {
  $("refreshBtn").disabled = true;

  try {
    const data = await apiRequest("/pipeline/status");
    const files = data.output_files || {};
    const entries = Object.entries(files);
    const found = entries.filter(([, file]) => file.exists).length;

    $("fileCount").textContent = `${found}/${entries.length}`;

    const summary = data.processing_summary;
    $("pipelineValue").textContent = summary
      ? "Summary available"
      : "Not available";

    const container = $("outputFiles");
    container.replaceChildren();

    if (entries.length === 0) {
      container.textContent = "No output-file information available.";
    }

    for (const [name, file] of entries) {
      const row = document.createElement("div");
      row.className = "file-row";

      const info = document.createElement("div");
      const title = document.createElement("strong");
      const path = document.createElement("small");

      title.textContent = name.replaceAll("_", " ");
      path.textContent = file.path;

      info.append(title, path);

      const state = document.createElement("span");
      state.className = `file-state ${file.exists ? "ok" : "missing"}`;
      state.textContent = file.exists ? "EXISTS" : "MISSING";

      row.append(info, state);
      container.append(row);
    }

    showJSON("pipelineResult", data);
  } catch (error) {
    showError("pipelineResult", error);
  } finally {
    $("refreshBtn").disabled = false;
  }
}

// 3. Trigger the complete pipeline
async function runPipeline() {
  const button = $("runPipelineBtn");
  button.disabled = true;
  button.textContent = "Running...";

  try {
    const data = await apiRequest("/pipeline/run", {
      method: "POST"
    });

    showJSON("pipelineResult", data);
    await refreshStatus();
  } catch (error) {
    showError("pipelineResult", error);
  } finally {
    button.disabled = false;
    button.textContent = "Run Pipeline";
  }
}

// 4. Ask the RAG system or the LLM agent
async function askQuestion() {
  const question = $("question").value.trim();

  if (!question) {
    $("answerResult").textContent = "Please enter a question.";
    return;
  }

  const button = $("askBtn");
  const mode = $("mode").value;

  button.disabled = true;
  button.textContent = "Thinking...";
  $("answerResult").textContent = "Waiting for the AI response...";

  try {
    let data;

    if (mode === "rag") {
      data = await apiRequest("/rag/ask", {
        method: "POST",
        body: JSON.stringify({
          question,
          top_k: Number($("topK").value),
          use_cache: $("useCache").checked
        })
      });
    } else {
      data = await apiRequest("/agent/ask", {
        method: "POST",
        body: JSON.stringify({ question })
      });
    }

    showJSON("answerResult", data);
  } catch (error) {
    showError("answerResult", error);
  } finally {
    button.disabled = false;
    button.textContent = "Ask Question";
  }
}

// 5. Search for a claim by its ID
async function searchClaim() {
  const claimId = $("claimId").value.trim();

  if (!claimId) {
    $("claimResult").textContent = "Please enter a claim ID.";
    return;
  }

  $("searchClaimBtn").disabled = true;

  try {
    const data = await apiRequest(
      `/claims/${encodeURIComponent(claimId)}`
    );

    showJSON("claimResult", data);
  } catch (error) {
    showError("claimResult", error);
  } finally {
    $("searchClaimBtn").disabled = false;
  }
}

// 6. Load agent audit history
async function loadAuditTrail() {
  $("auditBtn").disabled = true;

  try {
    const data = await apiRequest("/audit-trail");
    showJSON("auditResult", data);
  } catch (error) {
    showError("auditResult", error);
  } finally {
    $("auditBtn").disabled = false;
  }
}

// Connect buttons to their functions
$("refreshBtn").addEventListener("click", refreshStatus);
$("runPipelineBtn").addEventListener("click", runPipeline);
$("askBtn").addEventListener("click", askQuestion);
$("searchClaimBtn").addEventListener("click", searchClaim);
$("auditBtn").addEventListener("click", loadAuditTrail);

// Show retrieval options only for RAG mode
$("mode").addEventListener("change", () => {
  $("ragOptions").hidden = $("mode").value !== "rag";
});

// Initialize dashboard
checkHealth();
refreshStatus();
