export const validateEmail = (req, res, next) => {
  const { email } = req.body;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'อีเมลไม่ถูกต้อง',
      code: 'INVALID_EMAIL'
    });
  }

  next();
};

export const validatePassword = (req, res, next) => {
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ 
      error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      code: 'WEAK_PASSWORD'
    });
  }

  next();
};

export const validateRequiredFields = (requiredFields) => {
  return (req, res, next) => {
    const missing = [];

    for (const field of requiredFields) {
      if (!(field in req.body) || req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `ข้อมูลจำเป็นไม่ครบถ้วน: ${missing.join(', ')}`,
        code: 'MISSING_FIELDS',
        missingFields: missing
      });
    }

    next();
  };
};

export const validateEmployeeCreateRequest = (req, res, next) => {
  const requiredFields = ['email', 'first_name', 'last_name'];
  const missing = [];

  for (const field of requiredFields) {
    if (!req.body[field]) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return res.status(400).json({ 
      error: `ข้อมูลจำเป็นไม่ครบถ้วน: ${missing.join(', ')}`,
      code: 'MISSING_FIELDS',
      missingFields: missing
    });
  }

  next();
};

export const validateLeaveRequestCreate = (req, res, next) => {
  const requiredFields = ['leave_type', 'start_date', 'end_date'];
  const missing = [];

  for (const field of requiredFields) {
    if (!req.body[field]) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return res.status(400).json({ 
      error: `ข้อมูลจำเป็นไม่ครบถ้วน: ${missing.join(', ')}`,
      code: 'MISSING_FIELDS',
      missingFields: missing
    });
  }

  const startDate = new Date(req.body.start_date);
  const endDate = new Date(req.body.end_date);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ 
      error: 'รูปแบบวันที่ไม่ถูกต้อง',
      code: 'INVALID_DATE_FORMAT'
    });
  }

  if (startDate > endDate) {
    return res.status(400).json({ 
      error: 'วันเริ่มต้นต้องก่อนวันสิ้นสุด',
      code: 'INVALID_DATE_RANGE'
    });
  }

  next();
};