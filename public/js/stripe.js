import axios from 'axios';
import { showAlert } from './alerts';

const stripe = Stripe('');

export const bookTour = async (tourId) => {
  try {
    // 1) get the checkout session from API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
    );
    // 2) create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
