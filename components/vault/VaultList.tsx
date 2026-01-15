import React from 'react';
import type { VaultItem } from '../../types';
import { Icons } from '../icons/Icons';
import { VaultListItem } from './VaultListItem';
interface VaultListProps { 
  items: VaultItem[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onNavigate: (folder: VaultItem) => void;
  onView: (item: VaultItem) => void;
  onMenu: (item: VaultItem) => void;
}
export const VaultList: React.FC<VaultListProps> = ({ 
  items, selectionMode, selectedIds, onSelect, onNavigate, onView, onMenu 
}) => {
  const sortedItems = [...items].sort((a, b) => {
      if (a.type === b.type) return b.importedAt - a.importedAt;
      return a.type === 'FOLDER' ? -1 : 1;
  });
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-vault-500 gap-4">
        <div className="w-16 h-16 rounded-full bg-vault-800 flex items-center justify-center opacity-50">
          <Icons.Folder />
        </div>
        <p>Folder is empty</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-vault-700/50 pb-20">
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