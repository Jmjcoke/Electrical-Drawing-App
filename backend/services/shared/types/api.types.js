"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisErrorCodes = exports.UploadErrorCodes = void 0;
var UploadErrorCodes;
(function (UploadErrorCodes) {
    UploadErrorCodes["FILE_TOO_LARGE"] = "FILE_TOO_LARGE";
    UploadErrorCodes["INVALID_FILE_TYPE"] = "INVALID_FILE_TYPE";
    UploadErrorCodes["CORRUPTED_FILE"] = "CORRUPTED_FILE";
    UploadErrorCodes["UPLOAD_FAILED"] = "UPLOAD_FAILED";
    UploadErrorCodes["PROCESSING_FAILED"] = "PROCESSING_FAILED";
    UploadErrorCodes["TOO_MANY_FILES"] = "TOO_MANY_FILES";
    UploadErrorCodes["TOTAL_SIZE_EXCEEDED"] = "TOTAL_SIZE_EXCEEDED";
    UploadErrorCodes["PARTIAL_UPLOAD_FAILURE"] = "PARTIAL_UPLOAD_FAILURE";
})(UploadErrorCodes || (exports.UploadErrorCodes = UploadErrorCodes = {}));
var AnalysisErrorCodes;
(function (AnalysisErrorCodes) {
    AnalysisErrorCodes["RATE_LIMITED"] = "RATE_LIMITED";
    AnalysisErrorCodes["IMAGES_NOT_FOUND"] = "IMAGES_NOT_FOUND";
    AnalysisErrorCodes["MISSING_ANALYSIS_ID"] = "MISSING_ANALYSIS_ID";
    AnalysisErrorCodes["ANALYSIS_NOT_FOUND"] = "ANALYSIS_NOT_FOUND";
    AnalysisErrorCodes["INVALID_REQUEST"] = "INVALID_REQUEST";
    AnalysisErrorCodes["PROVIDER_ERROR"] = "PROVIDER_ERROR";
    AnalysisErrorCodes["TIMEOUT"] = "TIMEOUT";
    AnalysisErrorCodes["CONFIGURATION_ERROR"] = "CONFIGURATION_ERROR";
})(AnalysisErrorCodes || (exports.AnalysisErrorCodes = AnalysisErrorCodes = {}));
//# sourceMappingURL=api.types.js.map