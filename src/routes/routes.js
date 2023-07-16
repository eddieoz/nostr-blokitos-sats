import { zapNostr } from '../controllers/controller.js'

const routes = (app) => {
    app.route('/withdraw')
        .get(zapNostr)
}

export default routes