const STORAGE_KEYS = {
  token: 'alliance-web-token',
  zoneId: 'alliance-web-zone-id'
};

const state = {
  apiBase: '/api',
  token: sessionStorage.getItem(STORAGE_KEYS.token) || '',
  selectedZoneId: localStorage.getItem(STORAGE_KEYS.zoneId) || '',
  zones: [],
  dashboard: null,
  activeSection: 'season',
  keyword: '',
  flag: 'all',
  memberMetric: 'latest',
  boardView: 'hometownMain',
  archiveSort: {
    key: 'compositeScore',
    direction: 'desc'
  },
  membersSort: {
    key: 'power',
    direction: 'desc'
  },
  hasNoData: false
};

const elements = {
  loginScreen: document.querySelector('#loginScreen'),
  appShell: document.querySelector('#appShell'),
  username: document.querySelector('#username'),
  password: document.querySelector('#password'),
  loginButton: document.querySelector('#loginButton'),
  statusText: document.querySelector('#statusText'),
  refreshButton: document.querySelector('#refreshButton'),
  logoutButton: document.querySelector('#logoutButton'),
  headerHint: document.querySelector('#headerHint'),
  noDataSection: document.querySelector('#noDataSection'),
  sectionTabs: document.querySelector('#sectionTabs'),
  seasonSection: document.querySelector('#seasonSection'),
  alliancesSection: document.querySelector('#alliancesSection'),
  changesSection: document.querySelector('#changesSection'),
  membersSection: document.querySelector('#membersSection'),
  importSection: document.querySelector('#importSection'),
  zoneSelect: document.querySelector('#zoneSelect'),
  currentSeasonText: document.querySelector('#currentSeasonText'),
  currentSeasonBadge: document.querySelector('#currentSeasonBadge'),
  summaryGrid: document.querySelector('#summaryGrid'),
  timelineList: document.querySelector('#timelineList'),
  allianceGrid: document.querySelector('#allianceGrid'),
  changesList: document.querySelector('#changesList'),
  keywordInput: document.querySelector('#keywordInput'),
  memberMetricSelect: document.querySelector('#memberMetricSelect'),
  flagField: document.querySelector('#flagField'),
  flagFilter: document.querySelector('#flagFilter'),
  memberCount: document.querySelector('#memberCount'),
  memberList: document.querySelector('#memberList'),
  snapshotForm: document.querySelector('#snapshotForm'),
  snapshotZoneId: document.querySelector('#snapshotZoneId'),
  snapshotRecordedAt: document.querySelector('#snapshotRecordedAt'),
  snapshotSourceName: document.querySelector('#snapshotSourceName'),
  snapshotFile: document.querySelector('#snapshotFile'),
  snapshotCsvText: document.querySelector('#snapshotCsvText'),
  submitSnapshotButton: document.querySelector('#submitSnapshotButton')
};

function setStatus(message, type = 'neutral') {
  elements.statusText.textContent = message;
  elements.statusText.className = `status ${type}`;
}

function buildUrl(path) {
  const base = String(state.apiBase || '').replace(/\/+$/, '');
  const normalizedPath = String(path).startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

async function apiRequest(path, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(buildUrl(path), {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || '请求失败');
  }

  return payload;
}

function saveSession() {
  localStorage.setItem(STORAGE_KEYS.zoneId, state.selectedZoneId);
  if (state.token) {
    sessionStorage.setItem(STORAGE_KEYS.token, state.token);
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token);
  sessionStorage.removeItem(STORAGE_KEYS.token);
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) {
    return '--';
  }

  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDelta(value) {
  if (value === null || value === undefined) {
    return '首期';
  }

  if (value === 0) {
    return '0';
  }

  return `${value > 0 ? '+' : ''}${formatNumber(value)}`;
}

function deltaClass(value) {
  if (value === null || value === undefined || value === 0) {
    return 'delta-neutral';
  }

  return value > 0 ? 'delta-up' : 'delta-down';
}

function formatDate(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '--';
  }

  return `${(number * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatProjectLabel(projectId) {
  if (typeof projectId !== 'string') {
    return '当前项目';
  }

  const normalized = projectId.trim();
  if (!normalized || normalized.includes('placeholder')) {
    return '当前项目';
  }

  return normalized;
}

function isMetricMatrixMode() {
  return state.memberMetric !== 'latest';
}

function getComparableValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const number = Number(value);
  if (Number.isFinite(number) && String(value).trim() !== '') {
    return number;
  }

  return String(value);
}

function compareValues(left, right, direction = 'asc') {
  const leftValue = getComparableValue(left);
  const rightValue = getComparableValue(right);

  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  let result = 0;

  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    result = leftValue - rightValue;
  } else {
    result = String(leftValue).localeCompare(String(rightValue), 'zh-Hans-CN');
  }

  return direction === 'desc' ? -result : result;
}

function toggleSort(currentSort, key, defaultDirection = 'asc') {
  if (currentSort.key === key) {
    return {
      key,
      direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
    };
  }

  return {
    key,
    direction: defaultDirection
  };
}

function renderSortButton(scope, key, label, sortState) {
  const arrow = sortState.key === key ? (sortState.direction === 'asc' ? ' ↑' : ' ↓') : '';
  return `<button class="sort-button" type="button" data-sort-scope="${escapeHtml(scope)}" data-sort-key="${escapeHtml(key)}">${escapeHtml(label + arrow)}</button>`;
}

function getHistoryMetricLabel(metric) {
  return {
    latest: '最新快照明细',
    contributionWeek: '贡献本周',
    meritWeek: '战功本周',
    assistWeek: '助攻本周',
    donationWeek: '捐献本周',
    power: '势力值'
  }[metric] || '最新快照明细';
}

function getCurrentProject() {
  if (!state.dashboard) {
    return null;
  }

  return {
    projectId: state.dashboard.zoneId,
    snapshots: state.dashboard.timeline || []
  };
}

function getFilteredMembers() {
  const members = state.dashboard?.members || [];
  const keyword = state.keyword.trim().toLowerCase();

  return members.filter((member) => {
    const matchesKeyword = !keyword || [member.memberName, member.alliance, member.state, member.archive?.archiveType].some(
      (value) => typeof value === 'string' && value.toLowerCase().includes(keyword)
    );

    if (!matchesKeyword) {
      return false;
    }

    if (state.flag === 'all') {
      return true;
    }

    return Boolean(member.flags?.[state.flag]);
  });
}

function getSortedArchiveResults() {
  const rows = [...(state.dashboard?.archive?.results || [])];

  return rows.sort((left, right) => compareValues(
    left?.[state.archiveSort.key],
    right?.[state.archiveSort.key],
    state.archiveSort.direction
  ));
}

function getSortedLatestMembers() {
  const members = [...getFilteredMembers()];

  return members.sort((left, right) => {
    const leftValue = state.membersSort.key === 'archiveType'
      ? left.archive?.archiveType
      : state.membersSort.key === 'compositeScore'
        ? left.archive?.compositeScore
        : left[state.membersSort.key];
    const rightValue = state.membersSort.key === 'archiveType'
      ? right.archive?.archiveType
      : state.membersSort.key === 'compositeScore'
        ? right.archive?.compositeScore
        : right[state.membersSort.key];

    return compareValues(leftValue, rightValue, state.membersSort.direction);
  });
}

function getHistoryRows() {
  const history = state.dashboard?.history;
  const keyword = state.keyword.trim().toLowerCase();

  if (!history) {
    return [];
  }

  const filtered = history.members.filter((member) => {
    return !keyword || [member.memberName, member.alliance, member.state, member.archiveType].some(
      (value) => typeof value === 'string' && value.toLowerCase().includes(keyword)
    );
  });

  return filtered.sort((left, right) => {
    if (state.membersSort.key === 'memberName') {
      return compareValues(left.memberName, right.memberName, state.membersSort.direction);
    }

    const leftCell = left.snapshotValues?.[state.membersSort.key]?.[state.memberMetric] ?? null;
    const rightCell = right.snapshotValues?.[state.membersSort.key]?.[state.memberMetric] ?? null;
    return compareValues(leftCell, rightCell, state.membersSort.direction);
  });
}

function renderMemberLink(member) {
  return `
    <div class="mini-member">
      <strong>${escapeHtml(member.memberName)}</strong>
      <span>${escapeHtml(member.archiveType || member.latestArchiveType || '--')}</span>
    </div>
  `;
}

function renderBoardList(title, members, emptyText) {
  return `
    <section class="board-panel">
      <div class="board-panel-head">
        <h3>${escapeHtml(title)}</h3>
        <span>${escapeHtml(members.length)}</span>
      </div>
      ${members.length
        ? `<div class="board-list">
            ${members
              .map((member) => `
                <div class="board-row">
                  ${renderMemberLink(member)}
                  <div class="board-values">
                    <span>${escapeHtml(member.state || member.latestState || '--')}</span>
                    <span>${escapeHtml(member.alliance || member.latestAlliance || '--')}</span>
                    <span>跟 ${escapeHtml(member.projectCount || 1)} 项</span>
                  </div>
                </div>
              `)
              .join('')}
          </div>`
        : `<p class="empty-inline">${escapeHtml(emptyText)}</p>`}
    </section>
  `;
}

function getBoardSections(board = {}) {
  return [
    { key: 'hometownMain', title: '待迁', fullTitle: '老家待迁主力', emptyText: '暂无待迁主力', members: board.hometownMain || [] },
    { key: 'frontlineLow', title: '前线低活', fullTitle: '前线低活跃', emptyText: '暂无前线低活跃', members: board.frontlineLow || [] },
    { key: 'lowActivity', title: '观察', fullTitle: '低活跃观察', emptyText: '暂无低活跃观察', members: board.lowActivity || [] },
    { key: 'activeFighters', title: '战功', fullTitle: '战功活跃', emptyText: '暂无战功记录', members: board.activeFighters || [] },
    { key: 'longTermMembers', title: '老成员', fullTitle: '跨项目老成员', emptyText: '暂无跨项目成员', members: board.longTermMembers || [] }
  ];
}

function renderBoardSwitch(sections) {
  return `
    <div class="board-switch" role="tablist" aria-label="看板名单切换">
      ${sections
        .map((section) => `
          <button class="board-switch-button ${state.boardView === section.key ? 'is-active' : ''}" type="button" data-board-view="${escapeHtml(section.key)}">
            <span>${escapeHtml(section.title)}</span>
            <strong>${escapeHtml(section.members.length)}</strong>
          </button>
        `)
        .join('')}
    </div>
  `;
}

function renderSummary() {
  const overview = state.dashboard?.overview;
  const currentProject = getCurrentProject();
  const archiveSummary = state.dashboard?.archive?.summary;
  const board = state.dashboard?.board;
  const registrySummary = state.dashboard?.registry?.summary;

  if (!overview || !archiveSummary) {
    elements.summaryGrid.innerHTML = '';
    elements.currentSeasonBadge.textContent = '--';
    elements.currentSeasonText.textContent = '暂无项目数据';
    elements.headerHint.textContent = '先导入文件';
    return;
  }

  const projectLabel = formatProjectLabel(currentProject?.projectId);
  elements.currentSeasonBadge.textContent = projectLabel;
  elements.currentSeasonText.textContent = currentProject
    ? `当前展示 ${projectLabel}，共 ${currentProject.snapshots.length} 次统计`
    : '当前按最新快照展示';
  elements.headerHint.textContent = projectLabel;

  const cards = [
    ['最新统计', formatDate(overview.latestRecordedAt)],
    ['统计次数', overview.snapshotCount],
    ['总人数', archiveSummary.totals.totalMembers],
    ['黄淮前线人数', archiveSummary.totals.frontlineCount],
    ['荆州老家人数', archiveSummary.totals.hometownCount],
    ['前线占比', formatPercent(archiveSummary.totals.frontlineRatio)],
    ['本周有战功人数', archiveSummary.totals.meritActiveCount],
    ['本周无战功人数', archiveSummary.totals.noMeritCount],
    ['跨项目成员', registrySummary?.multiProjectCount || 0]
  ];

  const stateRows = archiveSummary.stateStats || [];
  const boardSections = getBoardSections(board);
  if (!boardSections.some((section) => section.key === state.boardView)) {
    state.boardView = boardSections[0].key;
  }
  const activeBoard = boardSections.find((section) => section.key === state.boardView) || boardSections[0];

  elements.summaryGrid.innerHTML = `
    <div class="kpi-grid">
      ${cards
        .map(
          ([label, value]) => `
            <div class="kpi-item">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join('')}
    </div>
    <div class="table-shell compact-shell">
      <table class="data-table compact-table">
        <thead>
          <tr>
            <th>所属州</th>
            <th>人数</th>
            <th>占比</th>
          </tr>
        </thead>
        <tbody>
          ${stateRows
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.state)}</td>
                  <td>${escapeHtml(item.count)}</td>
                  <td>${escapeHtml(formatPercent(item.ratio))}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="board-switch-card">
      ${renderBoardSwitch(boardSections)}
    </div>
    <div class="board-grid">
      ${renderBoardList(activeBoard.fullTitle, activeBoard.members, activeBoard.emptyText)}
    </div>
  `;
}

function renderTimeline() {
  const archiveTypeStats = state.dashboard?.archive?.summary?.archiveTypeStats || [];

  if (!archiveTypeStats.length) {
    elements.timelineList.innerHTML = '<article class="empty-state"><p>当前项目暂无归档分布。</p></article>';
    return;
  }

  elements.timelineList.innerHTML = `
    <div class="table-shell compact-shell">
      <table class="data-table compact-table">
        <thead>
          <tr>
            <th>归档类型</th>
            <th>人数</th>
            <th>占比</th>
            <th>代表成员</th>
          </tr>
        </thead>
        <tbody>
          ${archiveTypeStats
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.archiveType)}</td>
                  <td>${escapeHtml(item.count)}</td>
                  <td>${escapeHtml(formatPercent(item.ratio))}</td>
                  <td>${escapeHtml(item.sampleMembers.map((member) => member.memberName).join(' / ') || '--')}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="table-shell compact-shell">
      <table class="data-table compact-table">
        <thead>
          <tr>
            <th>统计时间</th>
            <th>来源</th>
            <th>人数</th>
            <th>门阀</th>
          </tr>
        </thead>
        <tbody>
          ${(getCurrentProject()?.snapshots || [])
            .map(
              (snapshot) => `
                <tr>
                  <td>${escapeHtml(formatDate(snapshot.recordedAt))}</td>
                  <td>${escapeHtml(snapshot.sourceName)}</td>
                  <td>${escapeHtml(snapshot.memberCount)}</td>
                  <td>${escapeHtml(snapshot.allianceCount)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAlliances() {
  const archiveResults = getSortedArchiveResults();
  if (!archiveResults.length) {
    elements.allianceGrid.innerHTML = '<article class="empty-state"><p>暂无归档结果。</p></article>';
    return;
  }

  elements.allianceGrid.innerHTML = `
    <div class="table-shell">
      <table class="data-table member-table">
        <thead>
          <tr>
            <th>${renderSortButton('archive', 'memberName', '成员', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'archiveType', '归档类型', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'state', '所属州', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'alliance', '门阀', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'contributionRank', '贡献排行', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'contributionWeek', '贡献本周', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'meritWeek', '战功本周', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'assistWeek', '助攻本周', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'donationWeek', '捐献本周', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'power', '势力值', state.archiveSort)}</th>
            <th>${renderSortButton('archive', 'compositeScore', '综合分', state.archiveSort)}</th>
            <th>跟随</th>
          </tr>
        </thead>
        <tbody>
          ${archiveResults
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.memberName)}</td>
                  <td>${escapeHtml(item.archiveType)}</td>
                  <td>${escapeHtml(item.state)}</td>
                  <td>${escapeHtml(item.alliance)}</td>
                  <td>${escapeHtml(item.contributionRank)}</td>
                  <td>${escapeHtml(formatNumber(item.contributionWeek))}</td>
                  <td>${escapeHtml(formatNumber(item.meritWeek))}</td>
                  <td>${escapeHtml(formatNumber(item.assistWeek))}</td>
                  <td>${escapeHtml(formatNumber(item.donationWeek))}</td>
                  <td>${escapeHtml(formatNumber(item.power))}</td>
                  <td>${escapeHtml(item.compositeScore)}</td>
                  <td>${escapeHtml(`${item.projectCount || 1} 项`)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderChanges() {
  const registryMembers = state.dashboard?.registry?.members || [];
  if (!registryMembers.length) {
    elements.changesList.innerHTML = '<article class="empty-state"><p>暂无成员档案。</p></article>';
    return;
  }

  elements.changesList.innerHTML = `
    <div class="table-shell">
      <table class="data-table member-table">
        <thead>
          <tr>
            <th>成员</th>
            <th>跟随项目数</th>
            <th>统计次数</th>
            <th>首次出现</th>
            <th>最近出现</th>
            <th>最近项目</th>
            <th>最近门阀</th>
            <th>最近州</th>
            <th>最近归档</th>
          </tr>
        </thead>
        <tbody>
          ${registryMembers
            .map(
              (member) => `
                <tr>
                  <td>${escapeHtml(member.memberName)}</td>
                  <td>${escapeHtml(member.projectCount)}</td>
                  <td>${escapeHtml(member.snapshotCount)}</td>
                  <td>${escapeHtml(formatDate(member.firstSeenAt))}</td>
                  <td>${escapeHtml(formatDate(member.lastSeenAt))}</td>
                  <td>${escapeHtml(member.latestProjectId)}</td>
                  <td>${escapeHtml(member.latestAlliance)}</td>
                  <td>${escapeHtml(member.latestState)}</td>
                  <td>${escapeHtml(member.latestArchiveType)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMembers() {
  elements.flagField.hidden = isMetricMatrixMode();

  if (isMetricMatrixMode()) {
    const history = state.dashboard?.history;
    const rows = getHistoryRows();
    elements.memberCount.textContent = String(rows.length);

    if (!history?.snapshots?.length || !rows.length) {
      elements.memberList.innerHTML = '<article class="empty-state"><p>当前筛选没有匹配成员。</p></article>';
      return;
    }

    elements.memberList.innerHTML = `
      <div class="table-shell">
        <table class="data-table member-table metric-matrix-table">
          <thead>
            <tr>
              <th>${renderSortButton('members', 'memberName', '成员', state.membersSort)}</th>
              ${history.snapshots
                .map(
                  (snapshot) => `<th>${renderSortButton('members', snapshot.id, formatDate(snapshot.recordedAt), state.membersSort)}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((member) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(member.memberName)}</strong>
                    <div class="sub-cell">${escapeHtml(member.archiveType)}</div>
                  </td>
                  ${history.snapshots
                    .map((snapshot) => {
                      const value = member.snapshotValues?.[snapshot.id]?.[state.memberMetric];
                      return `<td>${escapeHtml(formatNumber(value))}</td>`;
                    })
                    .join('')}
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </div>
    `;
      return;
  }

  const members = getSortedLatestMembers();
  elements.memberCount.textContent = String(members.length);

  if (!members.length) {
    elements.memberList.innerHTML = '<article class="empty-state"><p>当前筛选没有匹配成员。</p></article>';
    return;
  }

  elements.memberList.innerHTML = `
    <div class="table-shell">
      <table class="data-table member-table">
        <thead>
          <tr>
            <th>${renderSortButton('members', 'memberName', '成员', state.membersSort)}</th>
            <th>${renderSortButton('members', 'archiveType', '归档类型', state.membersSort)}</th>
            <th>${renderSortButton('members', 'alliance', '门阀', state.membersSort)}</th>
            <th>${renderSortButton('members', 'state', '州', state.membersSort)}</th>
            <th>${renderSortButton('members', 'contributionRank', '贡献排行', state.membersSort)}</th>
            <th>${renderSortButton('members', 'contributionWeek', '贡献本周', state.membersSort)}</th>
            <th>${renderSortButton('members', 'meritWeek', '战功本周', state.membersSort)}</th>
            <th>${renderSortButton('members', 'assistWeek', '助攻本周', state.membersSort)}</th>
            <th>${renderSortButton('members', 'donationWeek', '捐献本周', state.membersSort)}</th>
            <th>${renderSortButton('members', 'power', '势力值', state.membersSort)}</th>
            <th>${renderSortButton('members', 'compositeScore', '综合分', state.membersSort)}</th>
            <th>跟随</th>
            <th>标签</th>
          </tr>
        </thead>
        <tbody>
          ${members
            .map((member) => {
              const tags = [
                member.flags.active ? '活跃' : '',
                member.flags.landFarmer ? '地奴' : '',
                member.flags.idle ? '挂机' : '',
                member.flags.donor ? '捐献号' : ''
              ].filter(Boolean).join(' / ') || '--';

              return `
                <tr>
                  <td>${escapeHtml(member.memberName)}</td>
                  <td>${escapeHtml(member.archive?.archiveType || '--')}</td>
                  <td>${escapeHtml(member.alliance)}</td>
                  <td>${escapeHtml(member.state)}</td>
                  <td>${escapeHtml(member.contributionRank)}</td>
                  <td>${escapeHtml(formatNumber(member.contributionWeek))}</td>
                  <td>${escapeHtml(formatNumber(member.meritWeek))}</td>
                  <td>${escapeHtml(formatNumber(member.assistWeek))}</td>
                  <td>${escapeHtml(formatNumber(member.donationWeek))}</td>
                  <td>${escapeHtml(formatNumber(member.power))}</td>
                  <td>${escapeHtml(member.archive?.compositeScore ?? '--')}</td>
                  <td>${escapeHtml(`${member.career?.projectCount || 1} 项`)}</td>
                  <td>${escapeHtml(tags)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderZoneOptions() {
  elements.zoneSelect.innerHTML = state.zones
    .map(
      (zone) => `<option value="${escapeHtml(zone.zoneId)}">${escapeHtml(`${zone.zoneId} · ${zone.memberCount} 人`)}</option>`
    )
    .join('');

  if (state.selectedZoneId) {
    elements.zoneSelect.value = state.selectedZoneId;
    elements.snapshotZoneId.value = state.selectedZoneId;
  }
}

function updateVisibility() {
  const isAuthed = Boolean(state.token);

  elements.loginScreen.hidden = isAuthed;
  elements.appShell.hidden = !isAuthed;
  elements.sectionTabs.hidden = !isAuthed || state.hasNoData;
  elements.noDataSection.hidden = !isAuthed || !state.hasNoData;

  const sections = {
    season: elements.seasonSection,
    alliances: elements.alliancesSection,
    changes: elements.changesSection,
    members: elements.membersSection,
    import: elements.importSection
  };

  Object.entries(sections).forEach(([key, section]) => {
    if (!isAuthed) {
      section.hidden = true;
      return;
    }

    if (state.hasNoData) {
      section.hidden = key !== 'import';
      return;
    }

    section.hidden = state.activeSection !== key;
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.section === state.activeSection);
  });
}

function render() {
  if (elements.memberMetricSelect) {
    elements.memberMetricSelect.value = state.memberMetric;
  }
  renderZoneOptions();
  renderSummary();
  renderTimeline();
  renderAlliances();
  renderChanges();
  renderMembers();
  updateVisibility();
}

async function refreshDashboard() {
  if (!state.token) {
    render();
    return;
  }

  setStatus('正在加载当前项目...', 'neutral');

  const meta = await apiRequest('/meta');
  state.zones = meta.zones || [];

  if (!state.zones.length) {
    state.dashboard = null;
    state.hasNoData = true;
    state.activeSection = 'import';
    elements.snapshotZoneId.value = state.selectedZoneId || 'zone-demo';
    elements.headerHint.textContent = '暂无数据，请先导入文件';
    setStatus('暂无项目数据，请先导入 CSV 文件。', 'neutral');
    render();
    return;
  }

  state.hasNoData = false;
  if (!state.selectedZoneId || !state.zones.some((zone) => zone.zoneId === state.selectedZoneId)) {
    state.selectedZoneId = meta.defaultZoneId || state.zones[0].zoneId;
  }

  state.dashboard = await apiRequest(`/dashboard?zoneId=${encodeURIComponent(state.selectedZoneId)}`);
  elements.snapshotZoneId.value = state.selectedZoneId;
  state.activeSection = 'season';
  saveSession();
  setStatus(`已加载 ${formatProjectLabel(getCurrentProject()?.projectId)}。`, 'success');
  render();
}

async function loginAsAdmin() {
  try {
    elements.loginButton.disabled = true;
    saveSession();
    setStatus('正在登录...', 'neutral');
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: {
        username: elements.username.value.trim(),
        password: elements.password.value
      }
    });
    state.token = result.token;
    saveSession();
    await refreshDashboard();
  } catch (error) {
    setStatus(error.message || '登录失败', 'error');
  } finally {
    elements.loginButton.disabled = false;
    render();
  }
}

function logout(updateStatus = true) {
  state.token = '';
  state.dashboard = null;
  state.hasNoData = false;
  state.activeSection = 'season';
  clearSession();
  render();
  if (updateStatus) {
    setStatus('已退出登录。', 'neutral');
  }
}

async function decodeCsvFile(file) {
  const buffer = await file.arrayBuffer();
  const encodings = ['utf-8', 'gb18030'];

  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding, { fatal: false }).decode(buffer);
      if (text.includes('成员') && text.includes('贡献排行')) {
        return text;
      }
    } catch (error) {
      continue;
    }
  }

  return new TextDecoder('utf-8').decode(buffer);
}

async function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const csvText = await decodeCsvFile(file);
    elements.snapshotCsvText.value = csvText;
    elements.snapshotSourceName.value = file.name;
    setStatus(`已读取文件 ${file.name}。`, 'success');
  } catch (error) {
    setStatus('文件读取失败，请改为手动粘贴 CSV。', 'error');
  }
}

async function submitSnapshot(event) {
  event.preventDefault();

  try {
    elements.submitSnapshotButton.disabled = true;
    await apiRequest('/snapshots', {
      method: 'POST',
      body: {
        zoneId: elements.snapshotZoneId.value.trim(),
        recordedAt: elements.snapshotRecordedAt.value.trim() || new Date().toISOString(),
        sourceName: elements.snapshotSourceName.value.trim() || '手动录入',
        csvText: elements.snapshotCsvText.value
      }
    });

    state.selectedZoneId = elements.snapshotZoneId.value.trim();
    saveSession();
    elements.snapshotCsvText.value = '';
    elements.snapshotRecordedAt.value = '';
    elements.snapshotSourceName.value = '';
    elements.snapshotFile.value = '';
    await refreshDashboard();
    setStatus('文件导入成功，已加入当前项目。', 'success');
  } catch (error) {
    setStatus(error.message || '导入失败', 'error');
  } finally {
    elements.submitSnapshotButton.disabled = false;
  }
}

elements.loginButton.addEventListener('click', loginAsAdmin);
elements.refreshButton.addEventListener('click', () => {
  refreshDashboard().catch(() => {});
});
elements.logoutButton.addEventListener('click', () => logout(true));
elements.zoneSelect.addEventListener('change', async (event) => {
  state.selectedZoneId = event.target.value;
  saveSession();
  try {
    await refreshDashboard();
  } catch (error) {
  }
});
elements.keywordInput.addEventListener('input', (event) => {
  state.keyword = event.target.value;
  renderMembers();
});
elements.memberMetricSelect.addEventListener('change', (event) => {
  state.memberMetric = event.target.value;
  const latestSnapshotId = state.dashboard?.history?.snapshots?.[state.dashboard.history.snapshots.length - 1]?.id;
  state.membersSort = state.memberMetric === 'latest'
    ? { key: 'power', direction: 'desc' }
    : { key: latestSnapshotId || 'memberName', direction: latestSnapshotId ? 'desc' : 'asc' };
  renderMembers();
});
elements.flagFilter.addEventListener('change', (event) => {
  state.flag = event.target.value;
  renderMembers();
});
elements.allianceGrid.addEventListener('click', (event) => {
  const target = event.target.closest('[data-sort-scope="archive"]');
  if (!target) {
    return;
  }

  state.archiveSort = toggleSort(state.archiveSort, target.dataset.sortKey, target.dataset.sortKey === 'memberName' ? 'asc' : 'desc');
  renderAlliances();
});
elements.memberList.addEventListener('click', (event) => {
  const target = event.target.closest('[data-sort-scope="members"]');
  if (!target) {
    return;
  }

  state.membersSort = toggleSort(state.membersSort, target.dataset.sortKey, target.dataset.sortKey === 'memberName' ? 'asc' : 'desc');
  renderMembers();
});
elements.summaryGrid.addEventListener('click', (event) => {
  const target = event.target.closest('[data-board-view]');
  if (!target) {
    return;
  }

  state.boardView = target.dataset.boardView;
  renderSummary();
});
elements.snapshotFile.addEventListener('change', handleFileChange);
elements.snapshotForm.addEventListener('submit', submitSnapshot);
elements.sectionTabs.addEventListener('click', (event) => {
  const target = event.target.closest('.tab');
  if (!target) {
    return;
  }

  state.activeSection = target.dataset.section;
  updateVisibility();
});

if (state.token) {
  refreshDashboard().catch(() => {
    render();
  });
} else {
  render();
}