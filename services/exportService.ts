import { ParsedWalletItem } from '../types/wallet';

export function exportWalletsToCsv(wallets: ParsedWalletItem[], includeSecrets: boolean = false): void {
  const headers = [
    'ID',
    'Label',
    'Type',
    'Tags',
    'EVM Address',
    'Solana Address',
    'Total Value (USD)',
    'Non-Zero Chains Count',
    'Chains With Balance',
    'Details (Tokens & Native)',
    ...(includeSecrets ? ['Raw Secret (Mnemonic/Key)'] : []),
  ];

  const rows = wallets.map((w) => {
    const fundedChains = Object.values(w.chainAssets)
      .filter((a) => a.hasBalance)
      .map((a) => `${a.chainShortName}: ${a.nativeBalance} ($${a.totalValueUsd.toFixed(2)})`)
      .join(' | ');

    const tokenDetails = Object.values(w.chainAssets)
      .flatMap((a) =>
        a.tokens.map((t) => `${a.chainShortName}:${t.symbol}=${t.balance}($${t.valueUsd.toFixed(2)})`)
      )
      .join(' ; ');

    const row = [
      `"${w.id}"`,
      `"${w.label.replace(/"/g, '""')}"`,
      `"${w.type}"`,
      `"${(w.tags || []).join(', ')}"`,
      `"${w.evmAddress || ''}"`,
      `"${w.solanaAddress || ''}"`,
      `"${w.totalValueUsd.toFixed(2)}"`,
      `"${w.nonZeroChainsCount}"`,
      `"${fundedChains.replace(/"/g, '""')}"`,
      `"${tokenDetails.replace(/"/g, '""')}"`,
      ...(includeSecrets ? [`"${w.rawSecret.replace(/"/g, '""')}"`] : []),
    ];

    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  triggerDownload(
    csvContent,
    `jmbt_wallets_${includeSecrets ? 'FULL_BACKUP_' : 'SAFE_'}${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function exportWalletsToJson(wallets: ParsedWalletItem[], includeSecrets: boolean = false): void {
  const sanitized = wallets.map((w) => {
    const copy = { ...w };
    if (!includeSecrets) {
      delete (copy as any).rawSecret;
      if (copy.derivedAccounts) {
        copy.derivedAccounts = copy.derivedAccounts.map((d) => {
          const dCopy = { ...d };
          delete dCopy.evmPrivateKey;
          delete dCopy.solanaPrivateKey;
          return dCopy;
        });
      }
    }
    return copy;
  });

  const jsonContent = JSON.stringify(sanitized, null, 2);
  triggerDownload(
    jsonContent,
    `jmbt_wallets_${includeSecrets ? 'FULL_' : 'SAFE_'}${new Date().toISOString().slice(0, 10)}.json`,
    'application/json;charset=utf-8;'
  );
}

export function exportWalletsToTxt(wallets: ParsedWalletItem[], includeSecrets: boolean = false): void {
  const lines: string[] = [
    '==================================================================',
    ` JMBT WEB3 WALLET MANAGEMENT - EXPORT REPORT (${new Date().toLocaleString()})`,
    '==================================================================',
    '',
  ];

  let totalValueAll = 0;
  for (const w of wallets) {
    totalValueAll += w.totalValueUsd;
    lines.push(`------------------------------------------------------------------`);
    lines.push(`Label       : ${w.label}`);
    lines.push(`Type        : ${w.type.toUpperCase()}`);
    if (w.evmAddress) lines.push(`EVM Addr    : ${w.evmAddress}`);
    if (w.solanaAddress) lines.push(`SOL Addr    : ${w.solanaAddress}`);
    lines.push(`Total Value : $${w.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);
    
    if (includeSecrets) {
      lines.push(`Secret Key  : ${w.rawSecret}`);
    }

    const fundedChains = Object.values(w.chainAssets).filter((a) => a.hasBalance);
    if (fundedChains.length > 0) {
      lines.push(`Balances:`);
      for (const ch of fundedChains) {
        lines.push(`  • [${ch.category.toUpperCase()}] ${ch.chainName}: ${ch.nativeBalance} (≈ $${ch.nativeValueUsd.toFixed(2)})`);
        for (const tok of ch.tokens) {
          lines.push(`      - ${tok.symbol} (${tok.name}): ${tok.balance} (≈ $${tok.valueUsd.toFixed(2)})`);
        }
      }
    } else {
      lines.push(`Balances    : (No active assets detected or not scanned yet)`);
    }
    lines.push('');
  }

  lines.push('==================================================================');
  lines.push(`TOTAL PORTFOLIO MONITORED : $${totalValueAll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD across ${wallets.length} wallets`);
  lines.push('==================================================================');

  triggerDownload(
    lines.join('\n'),
    `jmbt_report_${new Date().toISOString().slice(0, 10)}.txt`,
    'text/plain;charset=utf-8;'
  );
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

