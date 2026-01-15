import React from 'react';
import type { VaultItem } from '../../types';
import { Icons, getFileIcon } from '../icons/Icons';
import { useLongPress } from '../../hooks/useLongPress';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
interface VaultListItemProps {
  item: VaultItem;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onNavigate: (folder: VaultItem) => void;
  onView: (item: VaultItem) => void;
  onMenu: (item: VaultItem) => void;
}
export const VaultListItem: React.FC<VaultListItemProps> = ({ 
  item, selectionMode, isSelected, onSelect, onNavigate, onView, onMenu 
}) => {
  const handlePress = () => {
      if (selectionMode) {
          onSelect(item.id);
      } else {
          if (item.type === 'FOLDER') onNavigate(item);
          else onView(item);
      }
  };
  const handleLongPress = async () => {
      if (!selectionMode) {
          try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch(e){}
          onSelect(item.id);
      }
  };
  const longPressProps = useLongPress(handleLongPress, handlePress, { delay: 400 });
  return (
    <div 
      {...longPressProps}
      className={`p-3 transition-all flex items-center justify-between group cursor-pointer relative select-none rounded-xl mx-2 my-1
        ${isSelected ? 'bg-vault-accent/10 ring-1 ring-vault-accent' : 'hover:bg-vault-800 active:bg-vault-800'}
      `}
    >
      <div className="flex items-center gap-4 overflow-hidden w-full">
        {selectionMode && (
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-vault-accent border-vault-accent scale-110' : 'border-vault-600'}`}>
                {isSelected && <span className="text-white text-xs"><Icons.Check /></span>}
            </div>
        )}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm ${item.type === 'FOLDER' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : 'bg-vault-800 text-vault-400 border border-vault-700/50'}`}>
          {getFileIcon(item.mimeType, item.originalName)}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <h4 className={`font-semibold text-sm truncate leading-tight ${isSelected ? 'text-vault-accent' : 'text-slate-200'}`}>{item.originalName}</h4>
          <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-vault-500 font-mono bg-vault-900/50 px-1.5 py-0.5 rounded border border-vault-800">
                {item.type === 'FOLDER' ? 'DIR' : item.originalName.split('.').pop()?.toUpperCase() || 'FILE'}
              </span>
              <span className="text-xs text-vault-500 truncate">
                 • {item.type === 'FOLDER' ? 'Folder' : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
              </span>
          </div>
        </div>
      </div>
      {!selectionMode && (
          <button 
            className="p-3 -mr-2 text-vault-500 hover:text-white transition-colors z-10 rounded-full hover:bg-vault-700 active:bg-vault-600"
            onClick={(e) => {
              e.stopPropagation();
              onMenu(item);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
              <Icons.MoreVertical />
          </button>
      )}
    </div>
  );
};