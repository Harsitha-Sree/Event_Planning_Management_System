/**
 * Calculates the completion percentage of a vendor's profile.
 * This is a simple calculation based on required/important fields.
 * You can customize which fields contribute to the percentage.
 *
 * @param {object} vendorProfile - The VendorProfile Mongoose document (or plain object).
 * @returns {number} The completion percentage (0-100).
 */
const calculateProfileCompletion = (vendorProfile) => {
  if (!vendorProfile) {
    return 0;
  }

  let completedFields = 0;
  let totalFields = 0;

  // Define fields that contribute to profile completion and their weight (or just 1 point each)
  const fieldsToCheck = [
    'companyName',
    'photo', // URL should exist
    'category',
    'location',
    'contactNumber',
    'description',
  ];

  fieldsToCheck.forEach(field => {
    totalFields++;
    if (vendorProfile[field] && (typeof vendorProfile[field] === 'string' ? vendorProfile[field].trim() !== '' : true)) {
      completedFields++;
    }
  });

  // Services: Consider if at least one service is provided
  totalFields++;
  if (vendorProfile.services && vendorProfile.services.length > 0) {
    completedFields++;
  }

  // You can add more complex logic, e.g., for each service having a photo, etc.
  // totalFields += vendorProfile.services.length * 2; // +1 for name, +1 for photo
  // vendorProfile.services.forEach(service => {
  //   if (service.name && service.name.trim() !== '') completedFields++;
  //   if (service.photo && service.photo.trim() !== '') completedFields++;
  // });

  if (totalFields === 0) {
    return 0;
  }

  const percentage = (completedFields / totalFields) * 100;
  return Math.round(percentage); // Round to nearest whole number
};

module.exports = {
  calculateProfileCompletion,
};