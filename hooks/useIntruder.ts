import { useState, useCallback } from 'react';
import { SecureVault } from '../plugins/SecureVaultPlugin';
import type { IntruderSession, IntruderSettings } from '../types';
export const useIntruder = () => {
  const [logs, setLogs] = useState<IntruderSession[]>([]);
  const [config, setConfig] = useState<IntruderSettings>({ enabled: false, photoCount: 1, source: 'FRONT' });
  const fetchLogs = useCallback(async () => {
    try {
        const data = await SecureVault.getIntruderLogs();
        setLogs(data);
    } catch(e) {
        console.error("Failed to fetch logs", e);
    }
  }, []);
  const loadSettings = useCallback(async () => {
      const settings = await SecureVault.getIntruderSettings();
      setConfig(settings);
      return settings;
  }, []);
  const saveSettings = async (newConfig: IntruderSettings) => {
      await SecureVault.setIntruderSettings(newConfig);
      setConfig(newConfig);
  };
  const capture = async () => {
      await SecureVault.captureIntruderEvidence();
  };
  const deleteLog = async (timestamp: number) => {
      await SecureVault.deleteIntruderSession({ timestamp });
      setLogs(prev => prev.filter(l => l.timestamp !== timestamp));
  };
  return {
      logs,
      config,
      fetchLogs,
      loadSettings,
      saveSettings,
      capture,
      deleteLog
  };
};