// The factory has 51 QC staff, each identified on paperwork as "QC1"..."QC51".
export const QC_NUMBERS = Array.from({ length: 51 }, (_, i) => `QC${i + 1}`);

export const QC_NUMBER_REGEX = /^QC([1-9]|[1-4][0-9]|5[01])$/;
