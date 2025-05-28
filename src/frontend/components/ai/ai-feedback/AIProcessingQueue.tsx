// AI Processing Queue Management Interface - Story 3.2

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAIProcessingQueue } from '@/hooks/ai/useAIAnalysisUpdates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { 
  Clock, 
  X, 
  Play, 
  Pause, 
  MoreVertical,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  FileText,
  AlertCircle
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface AIProcessingQueueProps {
  onJobSelect?: (jobId: string) => void;
  showControls?: boolean;
  maxDisplayItems?: number;
  className?: string;
}

interface QueueItemActionsProps {
  taskId: string;
  status: string;
  onCancel: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onMoveUp?: (taskId: string) => void;
  onMoveDown?: (taskId: string) => void;
}

const QueueItemActions: React.FC<QueueItemActionsProps> = ({
  taskId,
  status,
  onCancel,
  onRetry,
  onMoveUp,
  onMoveDown
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowMenu(!showMenu)}
        className="h-8 w-8 p-0"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {showMenu && (
        <div className="absolute right-0 top-8 z-10 bg-white border rounded-md shadow-lg py-1 min-w-[150px]">
          {status === 'queued' && (
            <>
              <button
                onClick={() => {
                  onMoveUp?.(taskId);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
              >
                <ArrowUp className="h-3 w-3" />
                <span>Move Up</span>
              </button>
              <button
                onClick={() => {
                  onMoveDown?.(taskId);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
              >
                <ArrowDown className="h-3 w-3" />
                <span>Move Down</span>
              </button>
              <div className="border-t my-1"></div>
            </>
          )}
          
          {status === 'failed' && (
            <button
              onClick={() => {
                onRetry?.(taskId);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Retry</span>
            </button>
          )}
          
          <button
            onClick={() => {
              onCancel(taskId);
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600 flex items-center space-x-2"
          >
            <X className="h-3 w-3" />
            <span>Cancel</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const AIProcessingQueue: React.FC<AIProcessingQueueProps> = ({
  onJobSelect,
  showControls = true,
  maxDisplayItems = 10,
  className
}) => {
  const { 
    queue, 
    cancelItem, 
    clearQueue, 
    getPosition, 
    getEstimatedWaitTime 
  } = useAIProcessingQueue();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const displayQueue = queue.slice(0, maxDisplayItems);
  const hasMoreItems = queue.length > maxDisplayItems;

  const toggleExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedItems(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <Badge variant="secondary">Queued</Badge>;
      case 'processing':
        return <Badge variant="default">Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const formatEstimatedTime = (milliseconds: number | null) => {
    if (!milliseconds) return 'Unknown';
    
    const minutes = Math.ceil(milliseconds / (60 * 1000));
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (queue.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-6 text-center">
          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Active Jobs</h3>
          <p className="text-gray-500">Processing queue is empty</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span>Processing Queue</span>
            <Badge variant="outline">{queue.length}</Badge>
          </div>
          
          {showControls && queue.length > 0 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearQueue()}
                className="text-red-600 hover:text-red-700"
              >
                Clear All
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {displayQueue.map((task, index) => {
          const position = getPosition(task.id);
          const estimatedWait = getEstimatedWaitTime(task.id);
          const isExpanded = expandedItems.has(task.id);
          const isProcessing = task.status === 'processing';
          
          return (
            <div
              key={task.id}
              className={cn(
                'border rounded-lg p-4 transition-all duration-200',
                getPriorityColor(task.priority),
                isProcessing && 'ring-2 ring-blue-500 ring-opacity-50'
              )}
            >
              {/* Main Item Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* Position Badge */}
                  {position && task.status === 'queued' && (
                    <Badge variant="outline" className="text-xs">
                      #{position}
                    </Badge>
                  )}
                  
                  {/* Processing Indicator */}
                  {isProcessing && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  )}
                  
                  {/* Drawing Info */}
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        Drawing {task.drawingId}
                      </p>
                      <p className="text-xs text-gray-500">
                        Added {formatRelativeTime(task.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Priority & Status */}
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs',
                        task.priority === 'high' && 'border-red-500 text-red-700',
                        task.priority === 'medium' && 'border-yellow-500 text-yellow-700',
                        task.priority === 'low' && 'border-green-500 text-green-700'
                      )}
                    >
                      {task.priority}
                    </Badge>
                    {getStatusBadge(task.status)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(task.id)}
                    className="h-8 w-8 p-0"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  
                  {showControls && (
                    <QueueItemActions
                      taskId={task.id}
                      status={task.status}
                      onCancel={cancelItem}
                    />
                  )}
                </div>
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Processing...</span>
                    <span>Stage: Component Detection</span>
                  </div>
                  <Progress value={35} className="h-1" />
                </div>
              )}

              {/* Estimated Wait Time */}
              {task.status === 'queued' && estimatedWait && (
                <div className="mt-3 flex items-center space-x-2 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  <span>Estimated wait: {formatEstimatedTime(estimatedWait)}</span>
                </div>
              )}

              {/* Error Details */}
              {task.status === 'failed' && (
                <div className="mt-3 flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-red-700">
                    <p className="font-medium">Analysis failed</p>
                    <p>The drawing could not be processed. Please try again or check the file format.</p>
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Task ID:</span>
                      <p className="font-mono">{task.id}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Drawing ID:</span>
                      <p className="font-mono">{task.drawingId}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <p>{task.createdAt.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Estimated Duration:</span>
                      <p>{task.estimatedDuration ? `${task.estimatedDuration / 1000}s` : 'Unknown'}</p>
                    </div>
                  </div>
                  
                  {onJobSelect && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onJobSelect(task.id)}
                        className="w-full"
                      >
                        View Details
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Show More Indicator */}
        {hasMoreItems && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-500">
              ... and {queue.length - maxDisplayItems} more items
            </p>
          </div>
        )}

        {/* Queue Summary */}
        <div className="pt-3 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Queued</p>
              <p className="text-lg font-semibold text-blue-600">
                {queue.filter(t => t.status === 'queued').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Processing</p>
              <p className="text-lg font-semibold text-orange-600">
                {queue.filter(t => t.status === 'processing').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completed</p>
              <p className="text-lg font-semibold text-green-600">
                {queue.filter(t => t.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};