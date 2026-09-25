import { toast } from 'sonner';

export const notify = {
  success: (message) => {
    toast.success(message, {
      duration: 4000,
    });
  },
  
  error: (message) => {
    toast.error(message || 'Something went wrong, please try again', {
      duration: 6000,
    });
  },
  
  info: (message) => {
    toast.info(message, {
      duration: 4000,
    });
  },
};
