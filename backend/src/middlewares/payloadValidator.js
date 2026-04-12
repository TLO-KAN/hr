export const payloadValidator = (err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ 
      error: 'ไฟล์หรือข้อมูลมีขนาดใหญ่เกินกำหนด (10MB)' 
    });
  }

  if (err instanceof SyntaxError && err?.status === 400 && 'body' in err) {
    return res.status(400).json({ 
      error: 'รูปแบบข้อมูล JSON ไม่ถูกต้อง' 
    });
  }

  next(err);
};