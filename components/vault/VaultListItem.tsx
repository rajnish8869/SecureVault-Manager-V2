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
      className={`
        relative flex items-center p-3 mb-2 rounded-2xl transition-all duration-200 border
        ${isSelected 
            ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
            : 'bg-vault-800 border-vault-700 hover:border-vault-600 active:scale-[0.98]'
        }
      `}
    >
      {/* Icon Area */}
      <div className="shrink-0 relative">
        <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all
            ${item.type === 'FOLDER' 
                ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' 
                : 'bg-vault-900 text-vault-400 border border-vault-800'
            }
        `}>
          {getFileIcon(item.mimeType, item.originalName)}
        </div>
        
        {/* Selection Checkmark Overlay */}
        {selectionMode && (
            <div className={`
                absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-vault-800 transition-all
                ${isSelected ? 'bg-blue-500 text-white scale-100' : 'bg-vault-600 text-transparent scale-90'}
            `}>
                <Icons.Check className="w-3 h-3 stroke-[4]" />
            </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 px-4">
        <h4 className={`text-sm font-semibold truncate leading-tight ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>
            {item.originalName}
        </h4>
        <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-bold text-vault-500 bg-vault-900 px-1.5 py-0.5 rounded border border-vault-800/50">
                {item.type === 'FOLDER' ? 'DIR' : item.originalName.split('.').pop()?.toUpperCase().slice(0,4) || 'FILE'}
            </span>
            <span className="text-xs text-vault-500 font-mono truncate">
                {item.type === 'FOLDER' ? 'Folder' : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
            </span>
        </div>
      </div>

      {/* Menu Button (Only non-selection mode) */}
      {!selectionMode && (
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full text-vault-500 hover:text-white hover:bg-vault-700/50 active:bg-vault-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onMenu(item);
            }}
            // Prevent event bubbling for long press logic
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
              <Icons.MoreVertical className="w-5 h-5" />
          </button>
      )}
    </div>
  );
};