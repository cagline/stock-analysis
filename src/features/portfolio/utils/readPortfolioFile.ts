import * as XLSX from 'xlsx';

/** Read ATrad Portfolio export as CSV text (supports .csv and .xlsx). */
export async function readPortfolioFileAsCsv(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      throw new Error('Excel file has no worksheets');
    }
    return XLSX.utils.sheet_to_csv(sheet);
  }
  return file.text();
}
