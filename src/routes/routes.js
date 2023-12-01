import { transferNFT, zapNostr } from '../controllers/controller.js'

const routes = (app) => {
    app.route('/withdraw')
        .get(zapNostr)
        app.route('/transferNFT')
        .get(transferNFT)
}

export default routes