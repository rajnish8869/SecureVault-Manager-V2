import React from 'react';
import type { VaultItem } from '../../types';
import { Icons, getFileIcon } from '../icons/Icons';
import { useLongPress } from '../../hooks/useLongPress';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useThumbnail } from '../../hooks/useThumbnail';

interface VaultGridItemProps {
  item: VaultItem;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onNavigate: (folder: VaultItem) => void;
  onView: (item: VaultItem) => void;
  onMenu: (item: VaultItem) => void;
}

export const VaultGridItem: React.FC<VaultGridItemProps> = ({ 
  item, selectionMode, isSelected, onSelect, onNavigate, onView, onMenu 
}) => {
  const shouldLoadThumbnail = 
    item.type === 'FILE' && 
    (item.mimeType.startsWith('image/') || 
     item.mimeType.startsWith('video/') || 
     item.mimeType === 'application/vnd.android.package-archive' ||
     item.originalName.endsWith('.apk'));

  const { thumbnail, loading } = useThumbnail({
    path: item.originalPath,
    mimeType: item.mimeType,
    disabled: !shouldLoadThumbnail,
    width: 256,
    height: 256
  });

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
        relative flex flex-col items-center p-3 rounded-2xl transition-all duration-200 border aspect-square justify-between overflow-hidden
        ${isSelected 
            ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
            : 'bg-vault-800 border-vault-700 hover:border-vault-600 active:scale-[0.98]'
        }
      `}
    >
      {/* Icon/Thumbnail Area */}
      <div className="flex-1 flex items-center justify-center w-full relative overflow-hidden rounded-xl bg-vault-900/50">
        {thumbnail ? (
            <img 
                src={thumbnail} 
                alt={item.originalName} 
                className="w-full h-full object-cover transition-opacity duration-300"
            />
        ) : (
            <div className={`
                w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all
                ${item.type === 'FOLDER' ? 'text-yellow-500' : 'text-vault-400'}
                ${loading ? 'animate-pulse opacity-50' : ''}
            `}>
              {getFileIcon(item.mimeType, item.originalName)}
            </div>
        )}
        
        {/* Type Badge for Videos/APKs if thumbnailed */}
        {thumbnail && (
            <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-sm px-1.5 rounded text-[8px] font-bold text-white uppercase pointer-events-none">
                {item.mimeType.startsWith('video/') ? 'VIDEO' : item.originalName.split('.').pop()?.slice(0,3)}
            </div>
        )}

        {/* Selection Checkmark Overlay */}
        {selectionMode && (
            <div className={`
                absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-vault-800 transition-all z-10
                ${isSelected ? 'bg-blue-500 text-white scale-100' : 'bg-vault-600 text-transparent scale-90'}
            `}>
                <Icons.Check className="w-3.5 h-3.5 stroke-[4]" />
            </div>
        )}
      </div>

      {/* Content Area */}
      <div className="w-full text-center mt-2 px-1">
        <h4 className={`text-xs font-semibold truncate leading-tight w-full ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>
            {item.originalName}
        </h4>
        <div className="flex items-center justify-center gap-1 mt-1 opacity-70">
             <span className="text-[9px] text-vault-500 font-mono truncate">
                {item.type === 'FOLDER' ? 'Folder' : `${(item.size / 1024 / 1024).toFixed(1)} MB`}
            </span>
        </div>
      </div>

      {/* Menu Button (Only non-selection mode) */}
      {!selectionMode && (
          <button 
            className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-full text-white/80 hover:text-white bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all z-10"
            onClick={(e) => {
              e.stopPropagation();
              onMenu(item);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
              <Icons.MoreVertical className="w-4 h-4 shadow-sm" />
          </button>
      )}
    </div>
  );
};
