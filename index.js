
export let router_interceptor={
	common:{
		after:function(to,from,NProgress,router){
		  NProgress.done(); // 结束Progress
		  if(to.matched.length==0){
		    router.push('/404')
		  }
		}
	},
	dev:{
		before:async function(to, from, next, options){
			options.NProgress.start(); // 开启Progress
			if (options.access_token) { // 判断是否有token
			    //set userInfo
			    if(!options.isFullUser){
			      let user = options.Base64.decode(options.access_token.split('.')[1]);
			      user = JSON.parse(user);
			      options.Cookies.set('oms-userInfo',user);
			      await options.getInfoFromSidm(user.empNbr).then(data=>{
			        let obj={
			          employeeNumber:data._id,
			          givenName:data.name,
			          deptCde:data.deptCde,
			          region: data.region
			        }
			        const usermax = Object.assign({},user,obj)
			        options.Cookies.set('oms-userInfo',usermax);
			        options.isFullUser = true;
			      })
			    }
			    if (options.store.getters.menus === undefined) { // 判断当前用户是否已拉取完user_info信息
			      await options.store.dispatch('GetInfo').then(info => { // 拉取user_info
			        const menus = {};
			        for (let i = 0; i < info.menus.length; i++) {
			          menus[info.menus[i].code] = true;
			        }
			        options.store.dispatch('GenerateRoutes', menus).then((res) => { // 生成可访问的路由表
			          options.router.addRoutes(options.store.getters.addRouters) // 动态添加可访问路由表
			          next(Object.assign({},to)); // hack方法 确保addRoutes已完成
			        })
			      }).catch(() => {
			        options.promissToVisit = false;
			        next({
			            path: '/'
			          });
			      })
			    } else {
			      next();
			    }
			} else {
			    if (options.whiteList.indexOf(to.path) !== -1) { // 在免登录白名单，直接进入
			      next()
			    } else {
			      // next('/login'); // 否则全部重定向到登录页
			      //setTimeout 防止未完全退出就跳转页面
						location.href=options.casHost+"/cas/login?service="+location.href.split("#")[0];
						options.NProgress.done();

			       // 在hash模式下 改变手动改变hash 重定向回来 不会触发afterEach 暂时hack方案 ps：history模式下无问题，可删除该行！
			    }
			}
			// options.sitRefresh=false;
		}
	},
	prod:{
		before:async function(to, from, next, options){
			options.NProgress.start(); // 开启Progress
			  if (options.access_token) { // 判断是否有token
			    //set userInfo
			    if(!options.isFullUser){
			      let user = options.Base64.decode(options.access_token.split('.')[1]);
			      user = JSON.parse(user);
			      await options.Cookies.set('oms-userInfo', user);
			      //为localhost开发保存的COOKIE
			      options.Cookies.set('access_tk_dev',options.access_token, {path:'/',domain:'chowsangsang.com'});

			      await options.getInfoFromSidm(user.empNbr).then(data=>{
			        let obj={
			          employeeNumber:data._id||'',
			          givenName:data.name||'',
			          deptCde:data.deptCde||'',
			          region: data.region||''
			        }
			        const usermax = Object.assign({},user,obj)
			        options.Cookies.set('oms-userInfo',usermax);
			        options.isFullUser = true;
			      })
			    }
			    if (options.store.getters.menus === undefined) { // 判断当前用户是否已拉取完user_info信息
			      if(!options.promissToVisit){
			        options.store.dispatch('delDomaCookie')
			        options.store.dispatch('FedLogOut')
			          .then(() => {
			            options.Cookies.remove('access_tk_dev', {
			              path: '/',
			              domain: 'chowsangsang.com'
			            })
			            options.Cookies.remove('access_token', {
			              path: '/',
			              domain: 'chowsangsang.com'
			            })

			          });
			        location.href='/static/401.html?u='+options.casHost
			      }
			      await options.store.dispatch('GetInfo').then(info => { // 拉取user_info
			        options.promissToVisit=true;
			        const menus = {};
			        for (let i = 0; i < info.menus.length; i++) {
			          menus[info.menus[i].code] = true;
			        }
			        options.store.dispatch('GenerateRoutes', menus).then(() => { // 生成可访问的路由表
			          options.router.addRoutes(options.store.getters.addRouters) // 动态添加可访问路由表
			          next(Object.assign({},to)); // hack方法 确保addRoutes已完成
			        })
			      }).catch(() => {
			        options.promissToVisit = false;
			        //需要刷新页面再跳到401页面
			        next({
			           path: '/'
			         });
			      })
			    } else {
			      next();
			    }
			  } else {
			    if (options.whiteList.indexOf(to.path) !== -1) { // 在免登录白名单，直接进入
			      next()
			    } else {
			      // next('/login'); // 否则全部重定向到登录页
			      //setTimeout 防止未完全退出就跳转页面
			      setTimeout(()=>{
			        location.href=options.casHost+'/cas/login?service='+location.href.split("#")[0];
			        options.NProgress.done();
			      },800)
			       // 在hash模式下 改变手动改变hash 重定向回来 不会触发afterEach 暂时hack方案 ps：history模式下无问题，可删除该行！
			    }
			  }
		}
	}
}

export let fetch_interceptor={
	request:function(config,system,Cookies,getAccessToken,process){
		let _con = Object.assign({},config)
		const userId = JSON.parse(Cookies.get("oms-userInfo")).empNbr
		// Do something before request is sent
		_con.headers['system'] = system;
		_con.headers['Authorization'] = getAccessToken();// 让每个请求携带token--['X-Token']为自定义key 请根据实际情况自行修改
		_con.headers['emploee'] = userId;
		if(process.env.NODE_ENV==='development'){
		  _con.headers['environment'] = 'development';
		  _con.headers['userId'] = userId;
		}
		return _con;
	},
	response:{
		res:function(response,Message){
			const res = response.data;
				if(response.status==403||response.status==401){
					//如果是登录超时刷新时，loginTimeout为true,不去401只提示超时
					console.log(error,'当前用户无相关操作权限')
					if(!store.getters.loginTimeout){
						store.dispatch('delDomaCookie')
						 store.dispatch('FedLogOut')
							 .then(() => {
								 Cookies.remove('access_tk_dev', {
									 path: '/',
									 domain: 'chowsangsang.com'
								 })
							 });
						 location.href='/static/401.html?u='+casHost;
					}
				}else{
					return response.data;
				}
		},
		error:function(error,store,MessageBox,Message,Cookies,casHost){
			//应后端要求写死 ；loginTimeout,401防止部分系统没把401改508
			    if (error == 'Error: Request failed with status code 508') {
			      if(store.getters.loginTimeout){
			        return;//第一次508才提示
			      }
			      store.dispatch('setLoginTimeout',true);

			      MessageBox({
			        message:'你已被登出，点击确定重新登录。',
			        type: 'warning'
			      }).then(() => {
			        location.href=casHost+'/cas/login?service='+location.href
			      })
			    }else{
			      Message({
			        message: error.message,
			        type: 'error',
			        duration: 5 * 1000
			      });
			    }
		}
	},
};
