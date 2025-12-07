import { Types } from 'komodo_client';

// Re-export types for compatibility and ease of use
export type KomodoContainer = Types.Container;
export type KomodoContainerListItem = Types.ContainerListItem;
export type KomodoServer = Types.Server;
export type KomodoServerListItem = Types.ServerListItem;
export type KomodoStack = Types.Stack;
export type KomodoStackListItem = Types.StackListItem;
export type KomodoDeployment = Types.Deployment;
export type KomodoDeploymentListItem = Types.DeploymentListItem;
export type KomodoUpdate = Types.Update;

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  message: string;
  details: {
    url: string;
    reachable: boolean;
    authenticated: boolean;
    responseTime: number;
    apiVersion?: string;
    error?: string;
  };
}
