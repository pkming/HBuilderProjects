const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-session-token';
const LEGACY_DEFAULT_ADMIN_PASSWORD = 'admin123456';
const STORE_FILE = path.join(__dirname, '../data/store.json');
const SAMPLE_DOC = path.resolve(__dirname, '../docs/同盟统计2026年05月08日11时00分34秒.csv');
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function ensureStoreFile() {
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ snapshots: [] }, null, 2));
  }
}

function readStore() {
  ensureStoreFile();
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function isAdminLoginValid(username, password) {
  if (username !== ADMIN_USERNAME) {
    return false;
  }

  if (password === ADMIN_PASSWORD) {
    return true;
  }

  return ADMIN_USERNAME === 'admin' && ADMIN_PASSWORD === LEGACY_DEFAULT_ADMIN_PASSWORD && password === 'admin';
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractRecordedAt(sourceName) {
  if (typeof sourceName !== 'string') {
    return new Date().toISOString();
  }

  const match = sourceName.match(/(\d{4})年(\d{2})月(\d{2})日(\d{2})时(\d{2})分(\d{2})秒/);
  if (!match) {
    return new Date().toISOString();
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

function parseCsvText(csvText) {
  const lines = String(csvText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV 内容不足，至少需要表头和一行数据');
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const record = {};
    headers.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] || '';
    });

    return {
      id: `${record['成员'] || 'member'}-${index + 1}`,
      memberName: record['成员'] || `成员${index + 1}`,
      contributionRank: parseNumber(record['贡献排行']),
      contributionWeek: parseNumber(record['贡献本周']),
      meritWeek: parseNumber(record['战功本周']),
      assistWeek: parseNumber(record['助攻本周']),
      donationWeek: parseNumber(record['捐献本周']),
      contributionTotal: parseNumber(record['贡献总量']),
      meritTotal: parseNumber(record['战功总量']),
      assistTotal: parseNumber(record['助攻总量']),
      donationTotal: parseNumber(record['捐献总量']),
      power: parseNumber(record['势力值']),
      state: record['所属州'] || '未知州',
      alliance: record['门阀'] || '未分盟'
    };
  });
}

function normalizeSnapshot(input) {
  return {
    id: input.id,
    zoneId: input.zoneId,
    seasonId: input.seasonId || input.zoneId || '未设置项目',
    recordedAt: input.recordedAt,
    sourceName: input.sourceName,
    rows: input.rows
  };
}

function createSnapshot(payload) {
  const sourceName = payload.sourceName || '手动导入';
  const rows = parseCsvText(payload.csvText);

  return normalizeSnapshot({
    id: `${payload.zoneId}-${Date.parse(payload.recordedAt)}-${rows.length}`,
    zoneId: payload.zoneId,
    seasonId: payload.seasonId || payload.zoneId,
    recordedAt: payload.recordedAt || extractRecordedAt(sourceName),
    sourceName,
    rows
  });
}

function createDemoFollowupSnapshot(baseSnapshot) {
  const removedIndexes = new Set([baseSnapshot.rows.length - 1, baseSnapshot.rows.length - 2]);
  const rows = baseSnapshot.rows
    .filter((row, index) => !removedIndexes.has(index))
    .map((row, index) => {
      const activityFactor = 0.015 + (index % 5) * 0.008;
      const contributionWeek = Math.max(0, Math.round(row.contributionWeek * activityFactor));
      const meritWeek = Math.max(0, Math.round(row.meritWeek * (0.45 + (index % 4) * 0.18)));
      const assistWeek = Math.max(0, Math.round(row.assistWeek * (0.4 + (index % 3) * 0.2)));
      const donationWeek = index % 37 === 0 ? 4200 : index % 19 === 0 ? 1200 : 0;
      const powerGrowth = index % 11 === 0 ? 1600 : index % 13 === 0 ? 80 : 520 + (index % 7) * 120;

      return {
        ...row,
        id: `${row.memberName}-followup-${index + 1}`,
        contributionWeek,
        meritWeek,
        assistWeek,
        donationWeek,
        contributionTotal: row.contributionTotal + contributionWeek,
        meritTotal: row.meritTotal + meritWeek,
        assistTotal: row.assistTotal + assistWeek,
        donationTotal: row.donationTotal + donationWeek,
        power: row.power + powerGrowth
      };
    });

  if (rows[0]) {
    rows[0].alliance = '乱世妖星';
  }

  if (rows[7]) {
    rows[7].alliance = '玄甲军';
  }

  if (rows[15]) {
    rows[15].contributionWeek = 0;
    rows[15].meritWeek = 0;
    rows[15].assistWeek = 0;
    rows[15].donationWeek = 0;
    rows[15].contributionTotal = baseSnapshot.rows[15].contributionTotal;
    rows[15].meritTotal = baseSnapshot.rows[15].meritTotal;
    rows[15].assistTotal = baseSnapshot.rows[15].assistTotal;
    rows[15].donationTotal = baseSnapshot.rows[15].donationTotal;
    rows[15].power = baseSnapshot.rows[15].power + 60;
  }

  rows.push({
    id: '新锐丨晨星-followup-new',
    memberName: '新锐丨晨星',
    contributionRank: 254,
    contributionWeek: 9800,
    meritWeek: 3600,
    assistWeek: 1800,
    donationWeek: 600,
    contributionTotal: 9800,
    meritTotal: 3600,
    assistTotal: 1800,
    donationTotal: 600,
    power: 11800,
    state: '黄淮',
    alliance: '玄甲军'
  });

  const recordedAtDate = new Date(baseSnapshot.recordedAt);
  recordedAtDate.setDate(recordedAtDate.getDate() + 3);

  return normalizeSnapshot({
    id: `${baseSnapshot.zoneId}-${recordedAtDate.getTime()}-${rows.length}`,
    zoneId: baseSnapshot.zoneId,
    seasonId: baseSnapshot.seasonId,
    recordedAt: recordedAtDate.toISOString(),
    sourceName: '演示环比快照',
    rows
  });
}

function getSnapshotMeta(snapshot) {
  const alliances = new Set(snapshot.rows.map((row) => row.alliance));
  return {
    id: snapshot.id,
    zoneId: snapshot.zoneId,
    seasonId: snapshot.seasonId,
    recordedAt: snapshot.recordedAt,
    sourceName: snapshot.sourceName,
    memberCount: snapshot.rows.length,
    allianceCount: alliances.size
  };
}

function compareWithPrevious(currentRow, previousRow) {
  if (!previousRow) {
    return {
      power: null,
      contributionTotal: null,
      meritTotal: null,
      assistTotal: null,
      donationTotal: null
    };
  }

  return {
    power: currentRow.power - previousRow.power,
    contributionTotal: currentRow.contributionTotal - previousRow.contributionTotal,
    meritTotal: currentRow.meritTotal - previousRow.meritTotal,
    assistTotal: currentRow.assistTotal - previousRow.assistTotal,
    donationTotal: currentRow.donationTotal - previousRow.donationTotal
  };
}

function getScoreThreshold(values, ratio, fallback = 0, order = 'desc') {
  if (!values.length) {
    return fallback;
  }

  const sorted = [...values].sort((left, right) => order === 'desc' ? right - left : left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)));
  return sorted[index] ?? fallback;
}

function computeFlags(row, delta, thresholds) {
  const powerDelta = delta.power || 0;
  const engagementScore = row.contributionWeek + row.meritWeek + row.assistWeek + row.donationWeek;
  const isActive = engagementScore >= thresholds.activeScore || powerDelta >= thresholds.activePowerGrowth;
  const isDonor = row.donationWeek >= thresholds.donorDonation && row.donationWeek > row.contributionWeek + row.meritWeek + row.assistWeek;
  const isIdle = engagementScore <= thresholds.idleScore && powerDelta <= thresholds.idlePowerGrowth;
  const isLandFarmer = row.power >= thresholds.averagePower && engagementScore <= thresholds.landFarmerScore && row.contributionWeek <= 500 && row.meritWeek <= 500;

  return {
    active: isActive,
    donor: isDonor,
    idle: isIdle,
    landFarmer: isLandFarmer
  };
}

function getContributionScore(value) {
  if (value >= 22000000) {
    return 40;
  }
  if (value >= 16000000) {
    return 35;
  }
  if (value >= 10000000) {
    return 28;
  }
  if (value >= 4600000) {
    return 18;
  }
  if (value > 0) {
    return 8;
  }
  return 0;
}

function getAssistScore(value) {
  if (value >= 10000) {
    return 25;
  }
  if (value >= 6000) {
    return 20;
  }
  if (value >= 2800) {
    return 14;
  }
  if (value >= 700) {
    return 8;
  }
  if (value > 0) {
    return 4;
  }
  return 0;
}

function getPowerScore(value) {
  if (value >= 22000) {
    return 20;
  }
  if (value >= 18000) {
    return 16;
  }
  if (value >= 14000) {
    return 12;
  }
  if (value >= 10000) {
    return 8;
  }
  if (value > 0) {
    return 4;
  }
  return 0;
}

function getMeritScore(value) {
  if (value >= 20000) {
    return 100;
  }
  if (value >= 10000) {
    return 85;
  }
  if (value >= 3000) {
    return 60;
  }
  if (value > 0) {
    return 35;
  }
  return 0;
}

function getRelocationScore(state) {
  if (state === '黄淮') {
    return 100;
  }
  if (state === '荆州') {
    return 20;
  }
  return 10;
}

function classifyArchive(row) {
  const activityScore = Math.min(
    85,
    getContributionScore(row.contributionWeek) + getAssistScore(row.assistWeek) + getPowerScore(row.power)
  );
  const meritScore = getMeritScore(row.meritWeek);
  const relocationScore = getRelocationScore(row.state);
  const compositeScore = Number((activityScore * 0.45 + meritScore * 0.35 + relocationScore * 0.2).toFixed(1));

  let archiveType = '老家低活跃观察';
  let suggestion = '暂留老家观察，降低资源投入，等待后续数据。';

  if (row.state === '黄淮' && row.meritWeek >= 10000) {
    archiveType = '前线主战核心';
    suggestion = '保留在黄淮作战组，优先安排打架、集火、驻守。';
  } else if (row.state === '黄淮' && (row.contributionWeek >= 16000000 || row.assistWeek >= 6000)) {
    archiveType = '前线高活跃支援';
    suggestion = '继续留前线，承担支援、铺路、补位和驻守任务。';
  } else if (row.state === '黄淮' && (row.contributionWeek >= 4600000 || row.assistWeek >= 700 || row.meritWeek > 0)) {
    archiveType = '前线普通活跃';
    suggestion = '可留前线执行常规任务，后续继续观察战功和助攻。';
  } else if (row.state === '黄淮') {
    archiveType = '前线低活跃观察';
    suggestion = '虽然在前线，但产出偏低，建议重点跟进执行度。';
  } else if (row.state === '荆州' && row.power >= 12000 && (row.contributionWeek >= 16000000 || row.assistWeek >= 6000 || row.meritWeek > 0)) {
    archiveType = '老家待迁主力';
    suggestion = '建议尽快迁往黄淮，优先补进前线主力或支援梯队。';
  } else if (row.state === '荆州' && (row.contributionWeek >= 10000000 || row.assistWeek >= 2800 || row.meritWeek >= 3000)) {
    archiveType = '老家活跃后备';
    suggestion = '保留为活跃后备，根据战况决定是否迁城支援。';
  } else if (row.state === '荆州' && (row.contributionWeek > 0 || row.assistWeek > 0 || row.power >= 10000)) {
    archiveType = '老家普通成员';
    suggestion = '继续留老家发育，按周观察是否进入待迁名单。';
  }

  return {
    archiveType,
    suggestion,
    activityScore,
    meritScore,
    relocationScore,
    compositeScore
  };
}

function buildArchiveSummary(members) {
  const totalMembers = members.length;
  const frontlineMembers = members.filter((member) => member.state === '黄淮');
  const hometownMembers = members.filter((member) => member.state === '荆州');
  const withMeritMembers = members.filter((member) => member.meritWeek > 0);
  const withoutMeritMembers = members.filter((member) => member.meritWeek === 0);
  const stateStats = [...new Set(members.map((member) => member.state))]
    .map((state) => {
      const count = members.filter((member) => member.state === state).length;
      return {
        state,
        count,
        ratio: totalMembers ? Number((count / totalMembers).toFixed(4)) : 0
      };
    })
    .sort((left, right) => right.count - left.count);

  const archiveTypeStats = [...new Set(members.map((member) => member.archive.archiveType))]
    .map((archiveType) => {
      const grouped = members.filter((member) => member.archive.archiveType === archiveType);
      return {
        archiveType,
        count: grouped.length,
        ratio: totalMembers ? Number((grouped.length / totalMembers).toFixed(4)) : 0,
        sampleMembers: grouped
          .slice()
          .sort((left, right) => right.archive.compositeScore - left.archive.compositeScore)
          .slice(0, 5)
          .map((member) => ({
            memberName: member.memberName,
            compositeScore: member.archive.compositeScore,
            contributionWeek: member.contributionWeek,
            meritWeek: member.meritWeek,
            assistWeek: member.assistWeek,
            power: member.power,
            alliance: member.alliance
          }))
      };
    })
    .sort((left, right) => right.count - left.count);

  return {
    totals: {
      totalMembers,
      frontlineCount: frontlineMembers.length,
      hometownCount: hometownMembers.length,
      frontlineRatio: totalMembers ? Number((frontlineMembers.length / totalMembers).toFixed(4)) : 0,
      meritActiveCount: withMeritMembers.length,
      noMeritCount: withoutMeritMembers.length
    },
    stateStats,
    archiveTypeStats
  };
}

function buildArchiveRules() {
  return [
    { item: '基础前提', rule: '前线 = 黄淮；老家 = 荆州。当前没有迁城历史，因此先按所属州近似判断。' },
    { item: '活跃分', rule: '贡献本周 + 助攻本周 + 势力值分段计分，最高 85 分。' },
    { item: '战功分', rule: '战功本周 >= 20000 记 100；>=10000 记 85；>=3000 记 60；>0 记 35；=0 记 0。' },
    { item: '迁城分', rule: '所属州为黄淮记 100；所属州为荆州记 20；其它州记 10。' },
    { item: '综合分', rule: '活跃分 * 45% + 战功分 * 35% + 迁城分 * 20%。' },
    { item: '前线主战核心', rule: '黄淮，且战功本周 >= 10000。' },
    { item: '前线高活跃支援', rule: '黄淮，贡献本周 >= 1600万 或 助攻本周 >= 6000。' },
    { item: '前线普通活跃', rule: '黄淮，贡献本周 >= 460万 或 助攻本周 >= 700 或 有战功。' },
    { item: '前线低活跃观察', rule: '黄淮，但贡献、助攻、战功均偏低。' },
    { item: '老家待迁主力', rule: '荆州，且具备高贡献 / 高助攻 / 有战功之一，并且势力值 >= 12000。' },
    { item: '老家活跃后备', rule: '荆州，且贡献、助攻、战功有明显活跃表现，但未到待迁主力。' },
    { item: '老家普通成员', rule: '荆州，有一定活跃或势力基础，但不属于主力后备。' },
    { item: '老家低活跃观察', rule: '荆州，整体贡献、助攻、战功都偏低。' }
  ];
}

function buildMemberRegistry(snapshots) {
  const registryMap = new Map();

  snapshots
    .slice()
    .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt))
    .forEach((snapshot) => {
      snapshot.rows.forEach((row) => {
        const existing = registryMap.get(row.memberName) || {
          memberName: row.memberName,
          projects: new Set(),
          snapshotCount: 0,
          firstSeenAt: snapshot.recordedAt,
          lastSeenAt: snapshot.recordedAt,
          firstProjectId: snapshot.zoneId,
          latestProjectId: snapshot.zoneId,
          latestAlliance: row.alliance,
          latestState: row.state,
          latestPower: row.power,
          latestContributionWeek: row.contributionWeek,
          latestMeritWeek: row.meritWeek,
          latestAssistWeek: row.assistWeek,
          latestArchiveType: classifyArchive(row).archiveType
        };

        existing.projects.add(snapshot.zoneId);
        existing.snapshotCount += 1;
        existing.lastSeenAt = snapshot.recordedAt;
        existing.latestProjectId = snapshot.zoneId;
        existing.latestAlliance = row.alliance;
        existing.latestState = row.state;
        existing.latestPower = row.power;
        existing.latestContributionWeek = row.contributionWeek;
        existing.latestMeritWeek = row.meritWeek;
        existing.latestAssistWeek = row.assistWeek;
        existing.latestArchiveType = classifyArchive(row).archiveType;
        registryMap.set(row.memberName, existing);
      });
    });

  const members = Array.from(registryMap.values())
    .map((member) => ({
      memberName: member.memberName,
      projectCount: member.projects.size,
      projects: Array.from(member.projects),
      snapshotCount: member.snapshotCount,
      firstSeenAt: member.firstSeenAt,
      lastSeenAt: member.lastSeenAt,
      firstProjectId: member.firstProjectId,
      latestProjectId: member.latestProjectId,
      latestAlliance: member.latestAlliance,
      latestState: member.latestState,
      latestPower: member.latestPower,
      latestContributionWeek: member.latestContributionWeek,
      latestMeritWeek: member.latestMeritWeek,
      latestAssistWeek: member.latestAssistWeek,
      latestArchiveType: member.latestArchiveType
    }))
    .sort((left, right) => right.projectCount - left.projectCount || new Date(right.lastSeenAt) - new Date(left.lastSeenAt));

  return {
    members,
    summary: {
      memberCount: members.length,
      multiProjectCount: members.filter((member) => member.projectCount > 1).length,
      projectCount: new Set(snapshots.map((snapshot) => snapshot.zoneId)).size,
      snapshotCount: snapshots.length
    }
  };
}

function buildManagementBoard(members, memberChanges, registry) {
  const byCompositeScore = (left, right) => (right.archive?.compositeScore || 0) - (left.archive?.compositeScore || 0);
  const byRisk = (left, right) => {
    const leftScore = (left.contributionWeek || 0) + (left.meritWeek || 0) + (left.assistWeek || 0);
    const rightScore = (right.contributionWeek || 0) + (right.meritWeek || 0) + (right.assistWeek || 0);
    return leftScore - rightScore;
  };
  const compactMember = (member) => ({
    memberName: member.memberName,
    archiveType: member.archive?.archiveType || '--',
    alliance: member.alliance,
    state: member.state,
    power: member.power,
    contributionWeek: member.contributionWeek,
    meritWeek: member.meritWeek,
    assistWeek: member.assistWeek,
    projectCount: member.career?.projectCount || 1,
    lastSeenAt: member.career?.lastSeenAt || null
  });

  return {
    hometownMain: members
      .filter((member) => member.archive?.archiveType === '老家待迁主力')
      .slice()
      .sort(byCompositeScore)
      .slice(0, 12)
      .map(compactMember),
    frontlineLow: members
      .filter((member) => member.archive?.archiveType === '前线低活跃观察')
      .slice()
      .sort(byRisk)
      .slice(0, 12)
      .map(compactMember),
    lowActivity: members
      .filter((member) => member.flags?.idle || member.archive?.archiveType === '老家低活跃观察')
      .slice()
      .sort(byRisk)
      .slice(0, 12)
      .map(compactMember),
    activeFighters: members
      .filter((member) => member.meritWeek > 0)
      .slice()
      .sort((left, right) => right.meritWeek - left.meritWeek)
      .slice(0, 12)
      .map(compactMember),
    changes: memberChanges.slice(0, 12),
    longTermMembers: registry.members
      .filter((member) => member.projectCount > 1)
      .slice(0, 12)
  };
}

function buildMemberHistory(zoneSnapshots, latestMembers) {
  const snapshotColumns = zoneSnapshots.map((snapshot) => ({
    id: snapshot.id,
    recordedAt: snapshot.recordedAt,
    sourceName: snapshot.sourceName,
    seasonId: snapshot.seasonId
  }));

  const latestMemberMap = new Map(latestMembers.map((member) => [member.memberName, member]));
  const memberNames = [...new Set(zoneSnapshots.flatMap((snapshot) => snapshot.rows.map((row) => row.memberName)))];

  const members = memberNames
    .map((memberName) => {
      const latestMember = latestMemberMap.get(memberName);
      const snapshotValues = Object.fromEntries(
        zoneSnapshots.map((snapshot) => {
          const row = snapshot.rows.find((item) => item.memberName === memberName);
          return [
            snapshot.id,
            row
              ? {
                  contributionWeek: row.contributionWeek,
                  meritWeek: row.meritWeek,
                  assistWeek: row.assistWeek,
                  donationWeek: row.donationWeek,
                  power: row.power,
                  contributionRank: row.contributionRank
                }
              : null
          ];
        })
      );

      return {
        memberName,
        alliance: latestMember?.alliance || '--',
        state: latestMember?.state || '--',
        archiveType: latestMember?.archive?.archiveType || '--',
        compositeScore: latestMember?.archive?.compositeScore ?? null,
        flags: latestMember?.flags || {
          active: false,
          donor: false,
          idle: false,
          landFarmer: false
        },
        snapshotValues
      };
    })
    .sort((left, right) => {
      const leftScore = latestMemberMap.get(left.memberName)?.power || 0;
      const rightScore = latestMemberMap.get(right.memberName)?.power || 0;
      return rightScore - leftScore || left.memberName.localeCompare(right.memberName, 'zh-Hans-CN');
    });

  return {
    snapshots: snapshotColumns,
    members
  };
}

function buildZoneDashboard(zoneId, snapshots) {
  const memberRegistry = buildMemberRegistry(snapshots);
  const registryMap = new Map(memberRegistry.members.map((member) => [member.memberName, member]));
  const zoneSnapshots = snapshots
    .filter((snapshot) => snapshot.zoneId === zoneId)
    .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt));

  if (!zoneSnapshots.length) {
    return null;
  }

  const latestSnapshot = zoneSnapshots[zoneSnapshots.length - 1];
  const previousSnapshot = zoneSnapshots[zoneSnapshots.length - 2] || null;
  const previousMap = new Map((previousSnapshot?.rows || []).map((row) => [row.memberName, row]));
  const latestMap = new Map(latestSnapshot.rows.map((row) => [row.memberName, row]));
  const engagementScores = latestSnapshot.rows.map(
    (row) => row.contributionWeek + row.meritWeek + row.assistWeek + row.donationWeek
  );
  const donationScores = latestSnapshot.rows.map((row) => row.donationWeek);
  const averagePower = latestSnapshot.rows.reduce((sum, row) => sum + row.power, 0) / latestSnapshot.rows.length;
  const thresholds = {
    activeScore: getScoreThreshold(engagementScores, 0.35, 12000, 'desc'),
    activePowerGrowth: 1000,
    donorDonation: Math.max(2000, getScoreThreshold(donationScores, 0.2, 2000, 'desc')),
    idleScore: Math.min(1200, getScoreThreshold(engagementScores, 0.15, 1200, 'asc')),
    idlePowerGrowth: 300,
    landFarmerScore: Math.min(1500, getScoreThreshold(engagementScores, 0.2, 1500, 'asc')),
    averagePower
  };

  const members = latestSnapshot.rows
    .map((row) => {
      const previousRow = previousMap.get(row.memberName);
      const delta = compareWithPrevious(row, previousRow);
      const flags = computeFlags(row, delta, thresholds);
      const archive = classifyArchive(row);
      const movement = !previousRow ? '新增' : previousRow.alliance !== row.alliance ? '转盟' : '留存';

      return {
        ...row,
        delta,
        flags,
        archive,
        career: registryMap.get(row.memberName) || null,
        movement
      };
    })
    .sort((left, right) => right.power - left.power);

  const archiveSummary = buildArchiveSummary(members);
  const memberHistory = buildMemberHistory(zoneSnapshots, members);
  const archiveResults = members
    .slice()
    .sort((left, right) => right.archive.compositeScore - left.archive.compositeScore)
    .map((member) => ({
      memberName: member.memberName,
      archiveType: member.archive.archiveType,
      suggestion: member.archive.suggestion,
      state: member.state,
      alliance: member.alliance,
      contributionRank: member.contributionRank,
      contributionWeek: member.contributionWeek,
      meritWeek: member.meritWeek,
      assistWeek: member.assistWeek,
      donationWeek: member.donationWeek,
      power: member.power,
      activityScore: member.archive.activityScore,
      meritScore: member.archive.meritScore,
      relocationScore: member.archive.relocationScore,
      compositeScore: member.archive.compositeScore
    }));

  const removedMembers = previousSnapshot
    ? previousSnapshot.rows
        .filter((row) => !latestMap.has(row.memberName))
        .map((row) => ({
          memberName: row.memberName,
          previousAlliance: row.alliance,
          type: '离开'
        }))
    : [];

  const movedMembers = members
    .filter((row) => row.movement === '转盟')
    .map((row) => ({
      memberName: row.memberName,
      previousAlliance: previousMap.get(row.memberName)?.alliance || '未知',
      currentAlliance: row.alliance,
      type: '转盟'
    }));

  const newMembers = members
    .filter((row) => row.movement === '新增')
    .map((row) => ({
      memberName: row.memberName,
      currentAlliance: row.alliance,
      type: '新增'
    }));

  const memberChanges = [...newMembers, ...movedMembers, ...removedMembers];
  const managementBoard = buildManagementBoard(members, memberChanges, memberRegistry);

  const allianceMap = new Map();
  members.forEach((member) => {
    const existing = allianceMap.get(member.alliance) || {
      alliance: member.alliance,
      memberCount: 0,
      totalPower: 0,
      activeCount: 0,
      donorCount: 0,
      idleCount: 0,
      landFarmerCount: 0,
      states: new Set(),
      recordedAt: latestSnapshot.recordedAt
    };

    existing.memberCount += 1;
    existing.totalPower += member.power;
    existing.activeCount += member.flags.active ? 1 : 0;
    existing.donorCount += member.flags.donor ? 1 : 0;
    existing.idleCount += member.flags.idle ? 1 : 0;
    existing.landFarmerCount += member.flags.landFarmer ? 1 : 0;
    existing.states.add(member.state);
    allianceMap.set(member.alliance, existing);
  });

  const allianceArchives = Array.from(allianceMap.values())
    .map((alliance) => ({
      alliance: alliance.alliance,
      memberCount: alliance.memberCount,
      totalPower: alliance.totalPower,
      averagePower: Math.round(alliance.totalPower / alliance.memberCount),
      activeCount: alliance.activeCount,
      donorCount: alliance.donorCount,
      idleCount: alliance.idleCount,
      landFarmerCount: alliance.landFarmerCount,
      states: Array.from(alliance.states),
      recordedAt: alliance.recordedAt
    }))
    .sort((left, right) => right.totalPower - left.totalPower);

  const seasons = [{
    seasonId: zoneId,
    snapshots: zoneSnapshots.map(getSnapshotMeta).sort((left, right) => new Date(right.recordedAt) - new Date(left.recordedAt))
  }];

  return {
    zoneId,
    overview: {
      latestRecordedAt: latestSnapshot.recordedAt,
      snapshotCount: zoneSnapshots.length,
      memberCount: members.length,
      allianceCount: allianceArchives.length,
      activeCount: members.filter((member) => member.flags.active).length,
      donorCount: members.filter((member) => member.flags.donor).length,
      idleCount: members.filter((member) => member.flags.idle).length,
      landFarmerCount: members.filter((member) => member.flags.landFarmer).length
    },
    latestSnapshot: getSnapshotMeta(latestSnapshot),
    previousSnapshot: previousSnapshot ? getSnapshotMeta(previousSnapshot) : null,
    allianceArchives,
    archive: {
      summary: archiveSummary,
      results: archiveResults,
      rules: buildArchiveRules()
    },
    board: managementBoard,
    registry: memberRegistry,
    history: memberHistory,
    memberChanges,
    members,
    seasons,
    timeline: zoneSnapshots.map(getSnapshotMeta).sort((left, right) => new Date(right.recordedAt) - new Date(left.recordedAt))
  };
}

function buildZonesMeta(snapshots) {
  const zoneIds = [...new Set(snapshots.map((snapshot) => snapshot.zoneId))];
  return zoneIds.map((zoneId) => {
    const dashboard = buildZoneDashboard(zoneId, snapshots);
    return {
      zoneId,
      snapshotCount: dashboard?.overview.snapshotCount || 0,
      latestRecordedAt: dashboard?.overview.latestRecordedAt || null,
      memberCount: dashboard?.overview.memberCount || 0
    };
  });
}

function seedSampleSnapshot() {
  const store = readStore();
  if (!fs.existsSync(SAMPLE_DOC)) {
    return;
  }

  const cleanedSnapshots = store.snapshots.filter(
    (snapshot) => !(snapshot.zoneId === 'zone-demo' && snapshot.sourceName === '演示环比快照')
  );
  if (cleanedSnapshots.length !== store.snapshots.length) {
    store.snapshots = cleanedSnapshots;
    writeStore(store);
  }

  const sourceName = path.basename(SAMPLE_DOC);
  const existingBase = store.snapshots.find(
    (snapshot) => snapshot.zoneId === 'zone-demo' && snapshot.sourceName === sourceName
  );
  let changed = false;
  let baseSnapshot = existingBase;

  if (!baseSnapshot) {
    const csvText = fs.readFileSync(SAMPLE_DOC, 'utf8');
    baseSnapshot = createSnapshot({
      zoneId: 'zone-demo',
      seasonId: 'zone-demo',
      recordedAt: extractRecordedAt(sourceName),
      sourceName,
      csvText
    });
    store.snapshots.push(baseSnapshot);
    changed = true;
  }

  if (changed) {
    writeStore(store);
  }
}

function requireAuth(request, response, next) {
  if (request.path === '/auth/login' || request.path === '/health') {
    next();
    return;
  }

  const authorization = request.headers.authorization || '';
  const token = authorization.replace('Bearer ', '');

  if (token !== ADMIN_TOKEN) {
    response.status(401).json({ message: '未登录或登录已失效' });
    return;
  }

  next();
}

seedSampleSnapshot();
app.use('/api', requireAuth);

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/auth/login', (request, response) => {
  const username = typeof request.body?.username === 'string' ? request.body.username.trim() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';

  if (!isAdminLoginValid(username, password)) {
    response.status(401).json({ message: '账号或密码错误' });
    return;
  }

  response.json({
    token: ADMIN_TOKEN,
    user: {
      username: ADMIN_USERNAME,
      displayName: '管理员'
    }
  });
});

app.get('/api/meta', (request, response) => {
  const store = readStore();
  const zones = buildZonesMeta(store.snapshots).sort((left, right) => new Date(right.latestRecordedAt || 0) - new Date(left.latestRecordedAt || 0));
  response.json({
    zones,
    defaultZoneId: zones[0]?.zoneId || null
  });
});

app.get('/api/dashboard', (request, response) => {
  const store = readStore();
  const zoneId = typeof request.query.zoneId === 'string' && request.query.zoneId ? request.query.zoneId : store.snapshots[0]?.zoneId;
  const dashboard = zoneId ? buildZoneDashboard(zoneId, store.snapshots) : null;

  if (!dashboard) {
    response.status(404).json({ message: '未找到对应赛区数据' });
    return;
  }

  response.json(dashboard);
});

app.get('/api/snapshots', (request, response) => {
  const store = readStore();
  const zoneId = typeof request.query.zoneId === 'string' ? request.query.zoneId : '';
  const snapshots = store.snapshots
    .filter((snapshot) => !zoneId || snapshot.zoneId === zoneId)
    .map(getSnapshotMeta)
    .sort((left, right) => new Date(right.recordedAt) - new Date(left.recordedAt));

  response.json({ snapshots });
});

app.post('/api/snapshots', (request, response) => {
  const zoneId = typeof request.body?.zoneId === 'string' ? request.body.zoneId.trim() : '';
  const csvText = typeof request.body?.csvText === 'string' ? request.body.csvText.trim() : '';

  if (!zoneId) {
    response.status(400).json({ message: 'zoneId 不能为空' });
    return;
  }

  if (!csvText) {
    response.status(400).json({ message: 'CSV 内容不能为空' });
    return;
  }

  const snapshot = createSnapshot({
    zoneId,
    seasonId: zoneId,
    recordedAt: typeof request.body?.recordedAt === 'string' && request.body.recordedAt ? request.body.recordedAt : new Date().toISOString(),
    sourceName: typeof request.body?.sourceName === 'string' ? request.body.sourceName.trim() : '手动导入',
    csvText
  });

  const store = readStore();
  const duplicate = store.snapshots.find(
    (item) => item.zoneId === snapshot.zoneId && item.recordedAt === snapshot.recordedAt && item.sourceName === snapshot.sourceName
  );

  if (duplicate) {
    response.status(409).json({ message: '同一赛区和时间的快照已经存在' });
    return;
  }

  store.snapshots.push(snapshot);
  writeStore(store);

  response.status(201).json({
    message: '快照导入成功',
    snapshot: getSnapshotMeta(snapshot)
  });
});

if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next();
      return;
    }

    response.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Alliance admin backend listening on port ${PORT}`);
});