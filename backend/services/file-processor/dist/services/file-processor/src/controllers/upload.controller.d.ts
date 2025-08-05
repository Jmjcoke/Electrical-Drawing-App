import { Request, Response, NextFunction } from 'express';
interface SessionRequest extends Request {
    session?: {
        id?: string;
    };
}
export declare class UploadController {
    uploadFile(req: Request, res: Response, next: NextFunction): Promise<void>;
    uploadMultipleFiles(req: SessionRequest, res: Response, next: NextFunction): Promise<void>;
    getUploadStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const uploadController: UploadController;
export {};
//# sourceMappingURL=upload.controller.d.ts.map