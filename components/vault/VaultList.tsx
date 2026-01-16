import React from 'react';
import type { VaultItem } from '../../types';
import { Icons } from '../icons/Icons';
import { VaultListItem } from './VaultListItem';
import { VaultGridItem } from './VaultGridItem';

interface VaultListProps { 
  items: VaultItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onNavigate: (folder: VaultItem) => void;
  onView: (item: VaultItem) => void;
  onMenu: (item: VaultItem) => void;
  viewMode: 'LIST' | 'GRID';
}

export const VaultList: React.FC<VaultListProps> = ({ 
  items, selectionMode, selectedIds, onSelect, onNavigate, onView, onMenu, viewMode
}) => {
  const sortedItems = [...items].sort((a, b) => {
      // Sort folders first, then files by date desc
      if (a.type !== b.type) return a.type === 'FOLDER' ? -1 : 1;
      return b.importedAt - a.importedAt;
  });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-vault-500 gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-vault-800/50 border border-vault-700/50 flex items-center justify-center shadow-inner">
          <Icons.Folder className="w-10 h-10 opacity-40" />
        </div>
        <div className="text-center">
            <p className="font-medium text-vault-400">Empty Folder</p>
            <p className="text-xs text-vault-600 mt-1">Tap + to add content</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'GRID') {
      return (
        <div className="grid grid-cols-3 gap-3 p-1 pb-4 animate-fade-in">
          {sortedItems.map(item => (
            <VaultGridItem 
              key={item.id} 
              item={item}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(item.id)}
              onSelect={onSelect}
              onNavigate={onNavigate}
              onView={onView}
              onMenu={onMenu}
            />
          ))}
        </div>
      );
  }

  return (
    <div className="pb-4 animate-fade-in">
      {sortedItems.map(item => (
        <VaultListItem 
          key={item.id} 
          item={item}
          selectionMode={selectionMode}
          isSelected={selectedIds.has(item.id)}
          onSelect={onSelect}
          onNavigate={onNavigate}
          onView={onView}
          onMenu={onMenu}
        />
      ))}
    </div>
  );
};
