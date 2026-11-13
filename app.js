const data = window.DASHBOARD_DATA;

const stageSummary = data.stageSummary;
const categorySummary = data.categorySummary;
const unlocks = data.unlockRecommendations;
const waterfall = data.waterfallTransitions;
const stages = data.stages.sort((a, b) => a.order - b.order);

const jobSelect = document.getElementById("job-select");
const stageSelect = document.getElementById("stage-select");
const heroSubtitle = document.getElementById("hero-subtitle");
const stageNote = document.getElementById("stage-note");
const nextStageLabel = document.getElementById("next-stage-label");
const stagePath = document.getElementById("stage-path");
const unlockList = document.getElementById("unlock-list");
const categoryGrid = document.getElementById("category-grid");
const waterfallBoard = document.getElementById("waterfall-board");
const waterfallCaption = document.getElementById("waterfall-caption");

function percentage(value) {
  return `${Number(value).toFixed(1)}%`;
}

function stageOrder(label) {
  const match = stages.find((stage) => stage.label === label);
  return match ? match.order : 0;
}

function getNextStage(label) {
  const currentOrder = stageOrder(label);
  return stages.find((stage) => stage.order === currentOrder + 1)?.label || null;
}

function uniqueJobs() {
  return data.jobs;
}

function selectedJob() {
  return jobSelect.value;
}

function selectedStage() {
  return stageSelect.value;
}

function recordsForJob(job) {
  return stageSummary.filter((record) => record.job_title === job);
}

function stageBlock(job, stageLabel) {
  return recordsForJob(job).filter((record) => record.exp_stage === stageLabel);
}

function stageCategories(job, stageLabel) {
  return categorySummary.filter(
    (record) => record.job_title === job && record.exp_stage === stageLabel
  );
}

function currentUnlocks(job, stageLabel) {
  return unlocks
    .filter(
      (record) =>
        record.job_title === job && record.current_stage === stageLabel
    )
    .sort((a, b) => a.unlock_rank - b.unlock_rank);
}

function currentWaterfall(job, stageLabel) {
  return waterfall.filter(
    (record) => record.job_title === job && record.current_stage === stageLabel
  );
}

function topSkillsForStage(job, stageLabel, limit = 5) {
  return stageBlock(job, stageLabel)
    .slice()
    .sort((a, b) => b.penetration_rate - a.penetration_rate)
    .slice(0, limit);
}

function buildCategoryBars(job, stageLabel) {
  const rows = stageCategories(job, stageLabel)
    .slice()
    .sort((a, b) => b.avg_penetration_rate - a.avg_penetration_rate);

  return rows
    .map(
      (row) => `
        <div>
          <div class="category-bar-label">
            <span>${row.skill_category_label}</span>
            <span>${percentage(row.avg_penetration_rate)}</span>
          </div>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="width:${Math.max(row.avg_penetration_rate, 2)}%"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderStagePath(job, activeStage) {
  const nextStage = getNextStage(activeStage);
  stagePath.innerHTML = stages
    .map((stage) => {
      const topSkills = topSkillsForStage(job, stage.label);
      const stageStats = stageBlock(job, stage.label);
      if (!stageStats.length) {
        return `
          <article class="stage-card">
            <h3 class="stage-title">${stage.label}</h3>
            <p class="stage-meta">该职位在这个阶段暂无足够样本。</p>
            <div class="empty-state">没有可展示的技能穿透数据。</div>
          </article>
        `;
      }

      const totalPeople = stageStats[0].total_people;
      const sourceStage = stageStats[0].source_stage_members;
      const cardClass = [
        "stage-card",
        stage.label === activeStage ? "active" : "",
        stage.label === nextStage ? "future" : "",
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <article class="${cardClass}">
          <h3 class="stage-title">${stage.label}</h3>
          <p class="stage-meta">${sourceStage} · ${totalPeople} 位样本</p>
          <div class="skill-chip-row">
            ${topSkills
              .map(
                (skill) =>
                  `<span class="skill-chip">${skill.skill_label} ${percentage(
                    skill.penetration_rate
                  )}</span>`
              )
              .join("")}
          </div>
          <div class="category-stack">
            ${buildCategoryBars(job, stage.label)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderUnlocks(job, stageLabel) {
  const rows = currentUnlocks(job, stageLabel);
  const nextStage = getNextStage(stageLabel);
  nextStageLabel.textContent = nextStage || "已到最高阶段";

  if (!rows.length) {
    unlockList.innerHTML = `
      <div class="empty-state">
        当前阶段没有下一档可比对，或者缺少足够样本来生成建议。
      </div>
    `;
    return;
  }

  unlockList.innerHTML = rows
    .map(
      (row) => `
        <article class="unlock-card">
          <span class="unlock-rank">#${row.unlock_rank}</span>
          <div class="unlock-category">${row.skill_category_label}</div>
          <h3 class="unlock-title">${row.skill_label}</h3>
          <p class="section-copy">
            同岗位从 <strong>${row.current_stage}</strong> 走向 <strong>${row.next_stage}</strong> 时，
            该技能的渗透率提升最明显。
          </p>
          <div class="unlock-metrics">
            <span class="metric-pill">当前 ${percentage(row.current_penetration)}</span>
            <span class="metric-pill">下一阶段 ${percentage(row.next_penetration)}</span>
            <span class="metric-pill">提升 ${percentage(row.delta_penetration)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderCategoryTrend(job) {
  const rows = categorySummary.filter((record) => record.job_title === job);
  const grouped = {};

  rows.forEach((row) => {
    if (!grouped[row.skill_category]) {
      grouped[row.skill_category] = {
        label: row.skill_category_label,
        values: {},
      };
    }
    grouped[row.skill_category].values[row.exp_stage] = row.avg_penetration_rate;
  });

  categoryGrid.innerHTML = Object.keys(grouped)
    .map((key) => {
      const group = grouped[key];
      return `
        <article class="category-trend-card">
          <strong>${group.label}</strong>
          <div class="trend-values">
            ${stages
              .map((stage) => {
                const value = group.values[stage.label] || 0;
                return `
                  <div class="trend-cell">
                    <span>${stage.label}</span>
                    <strong>${percentage(value)}</strong>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderWaterfall(job, stageLabel) {
  const rows = currentWaterfall(job, stageLabel);
  const nextStage = getNextStage(stageLabel);

  if (!rows.length || !nextStage) {
    waterfallCaption.textContent = "当前阶段没有可比较的下一阶段。";
    waterfallBoard.innerHTML = `
      <div class="empty-state">没有可展示的阶段迁移差异。</div>
    `;
    return;
  }

  waterfallCaption.textContent = `${job} 从 ${stageLabel} 迈向 ${nextStage} 时，增减最明显的技能如下。`;

  const gains = rows
    .filter((row) => row.delta_penetration > 0)
    .sort((a, b) => b.delta_penetration - a.delta_penetration)
    .slice(0, 5);

  const losses = rows
    .filter((row) => row.delta_penetration < 0)
    .sort((a, b) => a.delta_penetration - b.delta_penetration)
    .slice(0, 5);

  const combined = [];
  const maxRows = Math.max(gains.length, losses.length);

  for (let index = 0; index < maxRows; index += 1) {
    combined.push({
      gain: gains[index] || null,
      loss: losses[index] || null,
    });
  }

  const maxAbsDelta = Math.max(
    ...rows.map((row) => Math.abs(Number(row.delta_penetration))),
    1
  );

  waterfallBoard.innerHTML = combined
    .map(({ gain, loss }) => {
      const gainWidth = gain
        ? (Math.abs(Number(gain.delta_penetration)) / maxAbsDelta) * 100
        : 0;
      const lossWidth = loss
        ? (Math.abs(Number(loss.delta_penetration)) / maxAbsDelta) * 100
        : 0;

      return `
        <div class="waterfall-row">
          <div class="bar-side left">
            <div class="bar-track"></div>
            ${
              loss
                ? `<div class="bar-fill negative" style="width:${lossWidth}%"></div>`
                : ""
            }
          </div>
          <div class="bar-label">
            <div class="bar-skill">${loss ? loss.skill_label : gain ? gain.skill_label : ""}</div>
            <div class="bar-delta">
              ${loss ? `${percentage(loss.delta_penetration)} 逐步放弃` : ""}
              ${loss && gain ? " / " : ""}
              ${gain ? `+${percentage(gain.delta_penetration)} 新增采纳` : ""}
            </div>
          </div>
          <div class="bar-side">
            <div class="bar-track"></div>
            ${
              gain
                ? `<div class="bar-fill positive" style="width:${gainWidth}%"></div>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderHero() {
  heroSubtitle.textContent = data.meta.subtitle;
  stageNote.textContent = data.meta.stage_note;
}

function refresh() {
  const job = selectedJob();
  const stage = selectedStage();
  renderStagePath(job, stage);
  renderUnlocks(job, stage);
  renderCategoryTrend(job);
  renderWaterfall(job, stage);
}

function initSelectors() {
  jobSelect.innerHTML = uniqueJobs()
    .map((job) => `<option value="${job}">${job}</option>`)
    .join("");

  stageSelect.innerHTML = stages
    .slice(0, stages.length - 1)
    .map((stage) => `<option value="${stage.label}">${stage.label}</option>`)
    .join("");

  jobSelect.value = "Data Scientist";
  stageSelect.value = "2-4年";
}

function initEvents() {
  jobSelect.addEventListener("change", refresh);
  stageSelect.addEventListener("change", refresh);
}

renderHero();
initSelectors();
initEvents();
refresh();
