import {
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  Presentation,
} from 'lucide-react';

interface FileIconProps {
  extension: string;
  className?: string;
  strokeWidth?: number;
}

export function FileIcon({ extension, className, strokeWidth = 1.75 }: FileIconProps) {
  const props = { className, strokeWidth };
  const ext = extension.toLowerCase();

  switch (ext) {
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'txt':
    case 'md':
      return <FileText {...props} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return <FileImage {...props} />;
    case 'mp4':
    case 'mov':
      return <FileVideo {...props} />;
    case 'mp3':
      return <FileAudio {...props} />;
    case 'zip':
    case 'rar':
      return <FileArchive {...props} />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet {...props} />;
    case 'ppt':
    case 'pptx':
      return <Presentation {...props} />;
    default:
      return <File {...props} />;
  }
}
