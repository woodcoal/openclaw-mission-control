'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ImagePlus, X, Loader2, Camera, Plus, Upload } from 'lucide-react';
import type { TaskImage } from '@/lib/types';
import { useTranslations } from 'next-intl';

interface TaskImagesProps {
  taskId: string;
}

/**
 * 任务图片管理组件。
 * 允许用户为任务上传、查看和删除图片（如截图、原型图等）。
 */
export function TaskImages({ taskId }: TaskImagesProps) {
  const t = useTranslations('Images');
  
  const [images, setImages] = useState<TaskImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 加载任务关联的图片列表。
   */
  useEffect(() => {
    fetch(`/api/tasks/${taskId}/images`)
      .then(res => res.json())
      .then(data => setImages(data.images || []))
      .catch(() => setError(t('loadError')));
  }, [taskId, t]);

  /**
   * 处理图片上传。
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/tasks/${taskId}/images`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || t('uploadError'));
        return;
      }

      const data = await res.json();
      setImages(prev => [...prev, data.image]);
    } catch {
      setError(t('uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * 处理图片删除。
   */
  const handleDelete = async (filename: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      if (res.ok) {
        setImages(prev => prev.filter(img => img.filename !== filename));
      }
    } catch {
      setError(t('deleteError'));
    }
  };

  return (
    <div className="space-y-3">
      {/* 头部与上传按钮 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-mc-text-secondary">
          {t('title')} {images.length > 0 && `(${images.length})`}
        </h3>
        <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-mc-accent hover:bg-mc-accent/10 rounded cursor-pointer transition-colors border border-transparent hover:border-mc-accent/20">
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5" />
          )}
          {uploading ? t('uploading') : t('addImage')}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/5 p-2 rounded border border-red-500/20">{error}</p>
      )}

      {/* 空状态提示 */}
      {images.length === 0 && !error && (
        <p className="text-xs text-mc-text-secondary italic py-2">
          {t('emptyHint')}
        </p>
      )}

      {/* 图片网格展示 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img) => (
            <div key={img.filename} className="group relative rounded-lg overflow-hidden border border-mc-border bg-mc-bg shadow-sm hover:shadow-md transition-all">
              <Image
                src={`/api/task-images/${taskId}/${img.filename}`}
                alt={img.original_name}
                width={200}
                height={128}
                className="w-full h-32 object-cover"
              />
              {/* 删除按钮遮罩 */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <button
                  onClick={() => handleDelete(img.filename)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-red-500/90 hover:bg-red-500 rounded-full shadow-lg"
                  title={t('deleteError')}
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              {/* 图片名称说明 */}
              <div className="px-2 py-1.5 bg-mc-bg-secondary/80 backdrop-blur-sm border-t border-mc-border">
                <p className="text-[10px] text-mc-text-secondary truncate" title={img.original_name}>
                  {img.original_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
